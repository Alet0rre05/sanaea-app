"""Filtros de visibilidad por rol (privacidad inversa).

Cada función recibe la membresía activa y devuelve el queryset permitido.
El aislamiento entre agencias ya lo aplica TenantManager; aquí se aplica el
alcance DENTRO de la agencia.
"""
from iam.models import TenantRole as R
from operations.models import FamilyLink, Patient, TimesheetScan, Visit, DailyEvolution


def _patient_ids_for_family(membership):
    return FamilyLink.objects.filter(
        family_membership=membership, verified_at__isnull=False
    ).values_list("patient_id", flat=True)


def visible_patients(membership):
    if membership.role in {R.OWNER, R.ADMIN, R.LIQUIDATOR, R.MEDICAL_AUDITOR}:
        return Patient.objects.all()
    if membership.role == R.PROVIDER:
        return Patient.objects.filter(visits__professional__membership=membership).distinct()
    if membership.role == R.FAMILY_CLIENT:
        return Patient.objects.filter(id__in=_patient_ids_for_family(membership))
    return Patient.objects.none()


def visible_visits(membership):
    if membership.role in {R.OWNER, R.ADMIN, R.LIQUIDATOR, R.MEDICAL_AUDITOR}:
        return Visit.objects.all()
    if membership.role == R.PROVIDER:
        return Visit.objects.filter(professional__membership=membership)
    if membership.role == R.FAMILY_CLIENT:
        return Visit.objects.filter(patient_id__in=_patient_ids_for_family(membership))
    return Visit.objects.none()


def visible_evolutions(membership):
    """Solo auditor médico (todas) y prestador (sus visitas). Nunca facturación."""
    if membership.role == R.MEDICAL_AUDITOR:
        return DailyEvolution.objects.all()
    if membership.role == R.PROVIDER:
        return DailyEvolution.objects.filter(visit__professional__membership=membership)
    return DailyEvolution.objects.none()


def visible_scans(membership):
    if membership.role in {R.OWNER, R.ADMIN, R.LIQUIDATOR}:
        return TimesheetScan.objects.all()
    if membership.role == R.PROVIDER:
        return TimesheetScan.objects.filter(visit__professional__membership=membership)
    return TimesheetScan.objects.none()
