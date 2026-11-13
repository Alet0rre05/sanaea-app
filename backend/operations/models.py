"""Dominio de salud: pacientes, prestadores, tarifarios, visitas, planillas y liquidaciones.

Todos los modelos de agencia heredan de `TenantAwareModel`, por lo que quedan
aislados por tenant. Los datos personales y de salud se cifran a nivel de campo.
"""
from django.db import models

from core.models import BaseAuditModel, TenantAwareModel
from core.utils.crypto import EncryptedTextField


class Specialty(models.TextChoices):
    NURSE = "ENFERMERO", "Enfermero"
    CAREGIVER = "CUIDADOR", "Cuidador"
    KINESIOLOGIST = "KINESIOLOGO", "Kinesiólogo"


class BillingMethod(models.TextChoices):
    HOURLY = "HOURLY", "Por hora"
    PER_VISIT = "PER_VISIT", "Valor fijo por visita"


class VisitStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Programada"
    COMPLETED = "COMPLETED", "Completada"
    MISSED = "MISSED", "Faltante"


class ScanStatus(models.TextChoices):
    PENDING_REVIEW = "PENDING_REVIEW", "Pendiente de revisión"
    VALIDATED = "VALIDATED", "Validada"


class SettlementStatus(models.TextChoices):
    DRAFT = "DRAFT", "Borrador"
    VALIDATED = "VALIDATED", "Validada"


class Tariff(TenantAwareModel):
    """Tarifario vigente en un período. Los recargos son porcentajes sobre el valor hora."""

    name = models.CharField(max_length=200)
    billing_method = models.CharField(max_length=16, choices=BillingMethod.choices)
    valid_from = models.DateField()
    valid_to = models.DateField(null=True, blank=True)

    hour_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    visit_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    holiday_surcharge_percent = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True)
    night_surcharge_percent = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True)
    night_start = models.TimeField(null=True, blank=True)
    night_end = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ["-valid_from"]

    def __str__(self) -> str:
        return self.name


class HealthInsurance(TenantAwareModel):
    """Obra social o prepaga a la que se liquida la prestación."""

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=64, blank=True)
    tariff = models.ForeignKey(Tariff, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="insurances")

    def __str__(self) -> str:
        return self.name


class Patient(TenantAwareModel):
    full_name = EncryptedTextField()
    document_number = EncryptedTextField()
    address = EncryptedTextField(blank=True)
    health_insurance = models.ForeignKey(HealthInsurance, on_delete=models.PROTECT,
                                         null=True, blank=True, related_name="patients")
    is_active = models.BooleanField(default=True)


class Professional(TenantAwareModel):
    """Prestador en terreno (enfermero, cuidador o kinesiólogo)."""

    membership = models.OneToOneField(
        "iam.Membership", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="professional_profile",
    )
    full_name = EncryptedTextField()
    license_number = models.CharField(max_length=64)  # matrícula
    specialty = models.CharField(max_length=16, choices=Specialty.choices)
    is_active = models.BooleanField(default=True)


class FamilyLink(TenantAwareModel):
    """Vínculo entre un familiar (membresía FAMILY_CLIENT) y un paciente.

    Se considera verificado cuando el familiar confirma un OTP enviado a su correo.
    """

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="family_links")
    family_membership = models.ForeignKey("iam.Membership", on_delete=models.PROTECT,
                                          related_name="family_links")
    relationship = models.CharField(max_length=64, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "patient", "family_membership"],
                                    name="unique_family_link"),
        ]


class Holiday(BaseAuditModel):
    """Feriado nacional/local. No pertenece a una agencia: es dato de referencia global."""

    date = models.DateField(unique=True)
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ["date"]

    def __str__(self) -> str:
        return f"{self.date} {self.name}"


class Visit(TenantAwareModel):
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="visits")
    professional = models.ForeignKey(Professional, on_delete=models.PROTECT, related_name="visits")
    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField()
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=VisitStatus.choices,
                              default=VisitStatus.SCHEDULED)

    class Meta:
        indexes = [models.Index(fields=["tenant", "patient", "scheduled_start"])]
        ordering = ["scheduled_start"]


class DailyEvolution(TenantAwareModel):
    """Evolución médica de una visita. Contenido sensible: cifrado."""

    visit = models.ForeignKey(Visit, on_delete=models.PROTECT, related_name="evolutions")
    text = EncryptedTextField()
    recorded_at = models.DateTimeField(auto_now_add=True)


def scan_upload_path(instance, filename):
    import uuid
    from django.utils import timezone
    now = timezone.now()
    return f"scans/{now:%Y/%m}/{uuid.uuid4().hex}.{filename.rsplit('.', 1)[-1].lower()[:8]}"


class TimesheetScan(TenantAwareModel):
    """Foto de planilla física. Se bloquean duplicados por hash perceptual (pHash)."""

    image = models.ImageField(upload_to=scan_upload_path)
    image_phash = models.CharField(max_length=64, db_index=True)
    visit = models.ForeignKey(Visit, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="scans")
    status = models.CharField(max_length=24, choices=ScanStatus.choices,
                              default=ScanStatus.PENDING_REVIEW)
    extracted_payload = EncryptedTextField(default="{}")  # JSON cifrado
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "image_phash"],
                                    name="unique_scan_phash_per_tenant"),
        ]


class Settlement(TenantAwareModel):
    """Liquidación mensual a una obra social. Una vez validada es inmutable."""

    health_insurance = models.ForeignKey(HealthInsurance, on_delete=models.PROTECT,
                                         related_name="settlements")
    period_year = models.PositiveSmallIntegerField()
    period_month = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=16, choices=SettlementStatus.choices,
                              default=SettlementStatus.DRAFT)
    total_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "health_insurance", "period_year", "period_month"],
                name="unique_settlement_period",
            ),
        ]


class SettlementLine(TenantAwareModel):
    settlement = models.ForeignKey(Settlement, on_delete=models.CASCADE, related_name="lines")
    visit = models.ForeignKey(Visit, on_delete=models.PROTECT, related_name="settlement_lines")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    breakdown = models.JSONField(default=dict)
