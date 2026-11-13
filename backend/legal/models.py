"""Compliance by design: documentos versionados y registros de aceptación inmutables."""
from django.db import models

from core.immutable import ImmutableModelMixin, ImmutableQuerySet
from core.managers import TenantManager, TenantQuerySet
from core.models import BaseAuditModel, Tenant, TenantAwareModel
from core.utils.crypto import EncryptedTextField
from iam.models import CustomUser


class ImmutableTenantQuerySet(ImmutableQuerySet, TenantQuerySet):
    """Queryset inmutable que además filtra por tenant activo."""


class ImmutableTenantManager(TenantManager):
    queryset_class = ImmutableTenantQuerySet


class LegalKind(models.TextChoices):
    TOS = "TOS", "Términos de servicio"
    PRIVACY = "PRIVACY", "Política de privacidad"
    EULA = "EULA", "Acuerdo de licencia de usuario final"
    DPA = "DPA", "Acuerdo de procesamiento de datos"


class LegalDocument(BaseAuditModel):
    """Documento legal versionado. Una vez publicado, no puede modificarse:
    cada cambio genera una nueva versión."""

    kind = models.CharField(max_length=16, choices=LegalKind.choices)
    version = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    body = models.TextField()
    content_hash = models.CharField(max_length=64, editable=False)  # SHA-256 del cuerpo
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["kind", "version"], name="unique_legal_version"),
        ]
        ordering = ["kind", "-version"]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            from core.exceptions import ImmutableRecordError
            raise ImmutableRecordError("Un documento publicado no puede modificarse.")
        super().save(*args, **kwargs)


class LegalAcceptanceLog(ImmutableModelMixin, BaseAuditModel):
    """Aceptación de un documento: timestamp, IP y hash del documento aceptado."""

    user = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name="+")
    document = models.ForeignKey(LegalDocument, on_delete=models.PROTECT, related_name="+")
    document_hash = models.CharField(max_length=64)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "document"])]


class InformedConsent(ImmutableModelMixin, TenantAwareModel):
    """Consentimiento informado firmado en pantalla por el familiar."""

    objects = ImmutableTenantManager()
    unscoped = ImmutableQuerySet.as_manager()

    patient = models.ForeignKey("operations.Patient", on_delete=models.PROTECT, related_name="+")
    family_user = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name="+")
    document = models.ForeignKey(LegalDocument, on_delete=models.PROTECT, related_name="+")
    document_hash = models.CharField(max_length=64)
    signature_data = EncryptedTextField()  # imagen de la firma (data URL), cifrada
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    signed_at = models.DateTimeField(auto_now_add=True)


class TenantWithdrawal(ImmutableModelMixin, BaseAuditModel):
    """Solicitud de arrepentimiento / baja de una agencia. Registro inmutable."""

    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT, related_name="+")
    requested_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name="+")
    reason = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
