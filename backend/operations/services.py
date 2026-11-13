"""Lógica de negocio del dominio de salud (Service Layer).

Incluye: vínculos familiares con OTP, evoluciones, planillas con pHash,
liquidaciones, simulador y calendario de cobertura.
"""
import json
from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal

import imagehash
from django.db import transaction
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from iam import otp
from iam.models import OTPPurpose, TenantRole
from operations import scoping
from operations.billing import TariffError, VisitInput, calculator_for
from operations.models import (
    DailyEvolution, FamilyLink, Holiday, HealthInsurance, Patient, ScanStatus,
    Settlement, SettlementLine, SettlementStatus, TimesheetScan, Visit, VisitStatus,
)
from operations.ocr import get_extractor

# ---------------------------------------------------------------------------
# Vínculos familiares (verificación por OTP)
# ---------------------------------------------------------------------------
def request_family_link_code(family_membership, link_id) -> None:
    link = _visible_family_link(family_membership, link_id)
    otp.issue(family_membership.user, OTPPurpose.FAMILY_LINK_VERIFY,
              send_to=family_membership.user.email, target=str(link.id))


def verify_family_link(family_membership, link_id, code: str) -> FamilyLink:
    link = _visible_family_link(family_membership, link_id)
    if not otp.verify(family_membership.user, OTPPurpose.FAMILY_LINK_VERIFY, code,
                      target=str(link.id)):
        raise ValidationError({"code": ["Código inválido o vencido."]})
    link.verified_at = timezone.now()
    link.save(update_fields=["verified_at", "updated_at"])
    return link


def _visible_family_link(family_membership, link_id) -> FamilyLink:
    link = FamilyLink.objects.filter(pk=link_id, family_membership=family_membership).first()
    if link is None:
        raise NotFound("Vínculo no encontrado.")
    return link


def verify_license(actor, membership_id) -> None:
    """Verificación de matrícula de un prestador. Solo OWNER / ADMIN."""
    from iam.models import Membership
    if actor.role not in {TenantRole.OWNER, TenantRole.ADMIN}:
        raise PermissionDenied("Solo administración puede verificar matrículas.")
    membership = Membership.objects.filter(pk=membership_id, tenant_id=actor.tenant_id).first()
    if membership is None or membership.role != TenantRole.PROVIDER:
        raise NotFound("Prestador no encontrado.")
    membership.license_verified_at = timezone.now()
    membership.save(update_fields=["license_verified_at", "updated_at"])


# ---------------------------------------------------------------------------
# Evoluciones y visitas
# ---------------------------------------------------------------------------
def create_evolution(membership, visit_id, text: str) -> DailyEvolution:
    visit = scoping.visible_visits(membership).filter(pk=visit_id).first()
    if visit is None:
        raise NotFound("Visita no encontrada.")
    if visit.status != VisitStatus.COMPLETED:
        raise ValidationError({"visit": ["La evolución se registra sobre una visita completada."]})
    return DailyEvolution.objects.create(visit=visit, text=text, tenant_id=membership.tenant_id)


def complete_visit(membership, visit: Visit, actual_start: datetime, actual_end: datetime) -> Visit:
    if actual_end <= actual_start:
        raise ValidationError({"actual_end": ["Debe ser posterior al inicio."]})
    visit.actual_start = actual_start
    visit.actual_end = actual_end
    visit.status = VisitStatus.COMPLETED
    visit.save(update_fields=["actual_start", "actual_end", "status", "updated_at"])
    return visit


# ---------------------------------------------------------------------------
# Planillas escaneadas
# ---------------------------------------------------------------------------
def compute_phash(django_file) -> str:
    django_file.seek(0)
    with Image.open(django_file) as image:
        value = str(imagehash.phash(image))
    django_file.seek(0)
    return value


@transaction.atomic
def ingest_scan(membership, uploaded_file, visit_id=None) -> TimesheetScan:
    visit = None
    if visit_id:
        visit = scoping.visible_visits(membership).filter(pk=visit_id).first()
        if visit is None:
            raise NotFound("Visita no encontrada.")

    phash = compute_phash(uploaded_file)
    if TimesheetScan.objects.filter(image_phash=phash).exists():
        raise ValidationError({"image": ["Esta planilla ya fue cargada (duplicada)."]})

    scan = TimesheetScan(
        image=uploaded_file,
        image_phash=phash,
        visit=visit,
        tenant_id=membership.tenant_id,
    )
    scan.save()
    extracted = get_extractor().extract(scan.image.path) or {}
    scan.extracted_payload = json.dumps(extracted, ensure_ascii=False)
    scan.save(update_fields=["extracted_payload", "updated_at"])
    return scan


def read_scan_payload(scan: TimesheetScan) -> dict:
    return json.loads(scan.extracted_payload or "{}")


@transaction.atomic
def validate_scan(membership, scan: TimesheetScan, corrections: dict) -> TimesheetScan:
    if scan.status == ScanStatus.VALIDATED:
        raise ValidationError({"status": ["La planilla ya está validada."]})
    payload = read_scan_payload(scan)
    payload.update(corrections or {})
    scan.extracted_payload = json.dumps(payload, ensure_ascii=False)
    scan.status = ScanStatus.VALIDATED
    scan.validated_at = timezone.now()
    scan.save(update_fields=["extracted_payload", "status", "validated_at", "updated_at"])
    return scan


# ---------------------------------------------------------------------------
# Liquidaciones
# ---------------------------------------------------------------------------
def _local(dt: datetime) -> datetime:
    return timezone.localtime(dt) if timezone.is_aware(dt) else dt


def _holiday_dates(start: date, end: date) -> set[date]:
    return set(Holiday.objects.filter(date__gte=start, date__lte=end)
               .values_list("date", flat=True))


@transaction.atomic
def generate_settlement(membership, insurance_id, year: int, month: int) -> Settlement:
    insurance = HealthInsurance.objects.filter(pk=insurance_id).select_related("tariff").first()
    if insurance is None:
        raise NotFound("Obra social no encontrada.")
    if insurance.tariff is None:
        raise ValidationError({"tariff": ["La obra social no tiene tarifario asignado."]})

    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])
    settlement, _ = Settlement.objects.get_or_create(
        health_insurance=insurance, period_year=year, period_month=month,
        defaults={"tenant_id": membership.tenant_id},
    )
    if settlement.status == SettlementStatus.VALIDATED:
        raise ValidationError({"settlement": ["La liquidación ya está validada y es inmutable."]})

    visits = (
        Visit.objects.filter(
            patient__health_insurance=insurance,
            status=VisitStatus.COMPLETED,
            actual_start__date__gte=first_day,
            actual_start__date__lte=last_day,
        ).order_by("actual_start")
    )
    holidays = _holiday_dates(first_day, last_day)
    tariff = insurance.tariff
    if not (tariff.valid_from <= first_day and (tariff.valid_to is None or tariff.valid_to >= last_day)):
        raise ValidationError({"tariff": ["El tarifario no cubre todo el período."]})

    try:
        calculator = calculator_for(tariff)
    except TariffError as exc:
        raise ValidationError({"tariff": [str(exc)]}) from exc

    settlement.lines.all().delete()  # solo borrador: se regenera completo
    total = Decimal("0")
    for visit in visits:
        start, end = _local(visit.actual_start), _local(visit.actual_end)
        result = calculator.calculate(VisitInput(
            start=start, end=end, is_holiday=start.date() in holidays,
        ))
        SettlementLine.objects.create(
            settlement=settlement, visit=visit, amount=result.amount,
            breakdown=result.breakdown, tenant_id=membership.tenant_id,
        )
        total += result.amount

    settlement.total_amount = total
    settlement.save(update_fields=["total_amount", "updated_at"])
    return settlement


@transaction.atomic
def validate_settlement(settlement: Settlement) -> Settlement:
    if settlement.status == SettlementStatus.VALIDATED:
        raise ValidationError({"status": ["La liquidación ya está validada."]})
    settlement.status = SettlementStatus.VALIDATED
    settlement.validated_at = timezone.now()
    settlement.save(update_fields=["status", "validated_at", "updated_at"])
    return settlement


# ---------------------------------------------------------------------------
# Simulador y calendario de cobertura
# ---------------------------------------------------------------------------
def simulate_visit(tariff, start: datetime, end: datetime, is_holiday: bool) -> dict:
    try:
        result = calculator_for(tariff).calculate(
            VisitInput(start=start, end=end, is_holiday=is_holiday)
        )
    except TariffError as exc:
        raise ValidationError({"tariff": [str(exc)]}) from exc
    return {"amount": str(result.amount), "breakdown": result.breakdown}


def coverage_calendar(patient: Patient, year: int, month: int) -> dict:
    """Mapa de cobertura: por día, cantidad de visitas completadas, faltantes y programadas."""
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])
    visits = Visit.objects.filter(
        patient=patient,
        scheduled_start__date__gte=first_day,
        scheduled_start__date__lte=last_day,
    )
    calendar: dict[str, dict[str, int]] = {}
    for visit in visits:
        day = _local(visit.scheduled_start).date().isoformat()
        bucket = calendar.setdefault(day, {"completed": 0, "missed": 0, "scheduled": 0})
        key = {VisitStatus.COMPLETED: "completed",
               VisitStatus.MISSED: "missed"}.get(visit.status, "scheduled")
        bucket[key] += 1
    return calendar
