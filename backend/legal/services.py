"""Casos de uso legales: publicación de versiones, aceptaciones, consentimientos y baja."""
import hashlib

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from iam.models import CustomUser, TenantRole
from legal.models import InformedConsent, LegalAcceptanceLog, LegalDocument, LegalKind, TenantWithdrawal


def content_hash(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def latest_documents():
    """Última versión publicada de cada tipo."""
    latest = {}
    for doc in LegalDocument.objects.order_by("kind", "-version"):
        latest.setdefault(doc.kind, doc)
    return list(latest.values())


@transaction.atomic
def publish_document(kind: str, title: str, body: str) -> LegalDocument:
    if kind not in LegalKind.values:
        raise ValidationError({"kind": ["Tipo de documento no válido."]})
    current = LegalDocument.objects.filter(kind=kind).aggregate(m=Max("version"))["m"] or 0
    return LegalDocument.objects.create(
        kind=kind,
        version=current + 1,
        title=title,
        body=body,
        content_hash=content_hash(body),
    )


def pending_documents(user: CustomUser) -> list[LegalDocument]:
    """Versiones vigentes de los tipos requeridos que el usuario aún no aceptó."""
    required = set(settings.LEGAL_REQUIRED_KINDS)
    accepted_ids = set(
        LegalAcceptanceLog.objects.filter(user=user).values_list("document_id", flat=True)
    )
    return [
        doc for doc in latest_documents()
        if doc.kind in required and doc.id not in accepted_ids
    ]


def accept_document(user: CustomUser, document_id, ip: str | None) -> LegalAcceptanceLog:
    document = LegalDocument.objects.filter(pk=document_id).first()
    if document is None:
        raise NotFound("Documento no encontrado.")
    return LegalAcceptanceLog.objects.create(
        user=user,
        document=document,
        document_hash=document.content_hash,
        ip_address=ip,
    )


def sign_informed_consent(membership, patient_id, document_id, signature_data: str,
                          ip: str | None) -> InformedConsent:
    """El familiar firma en pantalla. Requiere vínculo verificado con el paciente."""
    from operations.models import FamilyLink, Patient

    if membership.role != TenantRole.FAMILY_CLIENT:
        raise PermissionDenied("Solo el familiar vinculado puede firmar el consentimiento.")
    link_exists = FamilyLink.objects.filter(
        family_membership=membership, patient_id=patient_id, verified_at__isnull=False,
    ).exists()
    if not link_exists:
        raise PermissionDenied("No estás vinculado verificado con este paciente.")

    patient = Patient.objects.filter(pk=patient_id).first()
    document = LegalDocument.objects.filter(pk=document_id).first()
    if patient is None or document is None:
        raise NotFound("Paciente o documento no encontrado.")

    return InformedConsent.objects.create(
        patient=patient,
        family_user=membership.user,
        document=document,
        document_hash=document.content_hash,
        signature_data=signature_data,
        ip_address=ip,
        tenant_id=membership.tenant_id,
    )


def withdraw_tenant(membership, reason: str, ip: str | None) -> TenantWithdrawal:
    """Registra la baja de la agencia y la desactiva. Acción de TENANT_OWNER."""
    withdrawal = TenantWithdrawal.objects.create(
        tenant_id=membership.tenant_id,
        requested_by=membership.user,
        reason=reason,
        ip_address=ip,
    )
    tenant = membership.tenant
    tenant.is_active = False
    tenant.save(update_fields=["is_active", "updated_at"])
    return withdrawal
