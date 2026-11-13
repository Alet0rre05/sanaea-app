"""Casos de uso de comunicaciones: chat operativo, hilos internos y soporte global."""
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from comms.models import (
    ChatMessage, ContextTargetType, InternalComment, InternalContextThread,
    ScopedVisitChat, SupportMessage,
)
from comms.sanitizer import sanitize_support_text
from comms.policy import is_chat_open
from iam.models import TenantRole as R
from operations import scoping
from operations.models import FamilyLink, Settlement, TimesheetScan

CHAT_BANNER = "Solo coordinación logística. Urgencias: 107/911"


# ---------------------------------------------------------------------------
# Chat operativo de visita
# ---------------------------------------------------------------------------
def _visit_for_participant(membership, visit_id):
    """La visita debe ser visible para el participante (prestador asignado o familiar vinculado)."""
    if membership.role not in {R.PROVIDER, R.FAMILY_CLIENT}:
        raise PermissionDenied("Solo prestadores y familiares participan del chat operativo.")
    visit = scoping.visible_visits(membership).filter(pk=visit_id).select_related("patient").first()
    if visit is None:
        raise NotFound("Visita no encontrada.")
    return visit


def list_chat(membership, visit_id) -> dict:
    visit = _visit_for_participant(membership, visit_id)
    chat = ScopedVisitChat.objects.filter(visit=visit).first()
    messages = (
        ChatMessage.objects.filter(chat=chat).select_related("author") if chat else []
    )
    return {
        "open": is_chat_open(visit, timezone.now()),
        "banner": CHAT_BANNER,
        "messages": [
            {"id": str(m.id), "author_id": str(m.author_id), "body": m.body,
             "created_at": m.created_at}
            for m in messages
        ],
    }


def post_chat_message(membership, visit_id, body: str) -> ChatMessage:
    visit = _visit_for_participant(membership, visit_id)
    if not is_chat_open(visit, timezone.now()):
        raise ValidationError({"chat": ["El chat se habilita 2 horas antes y después de la visita."]})
    chat, _ = ScopedVisitChat.objects.get_or_create(
        visit=visit, defaults={"tenant_id": membership.tenant_id},
    )
    return ChatMessage.objects.create(
        chat=chat, author=membership.user, body=body.strip(), tenant_id=membership.tenant_id,
    )


# ---------------------------------------------------------------------------
# Hilos contextuales internos
# ---------------------------------------------------------------------------
def _ensure_target_visible(membership, target_type: str, target_id) -> None:
    if target_type == ContextTargetType.SCAN:
        exists = scoping.visible_scans(membership).filter(pk=target_id).exists()
    elif target_type == ContextTargetType.SETTLEMENT:
        if membership.role not in {R.OWNER, R.ADMIN, R.LIQUIDATOR}:
            raise PermissionDenied("Tu rol no accede a liquidaciones.")
        exists = Settlement.objects.filter(pk=target_id).exists()
    else:
        raise ValidationError({"target_type": ["Tipo de destino no válido."]})
    if not exists:
        raise NotFound("Destino no encontrado.")


def create_thread(membership, target_type: str, target_id, title: str = "") -> InternalContextThread:
    if membership.role == R.FAMILY_CLIENT:
        raise PermissionDenied("Los familiares no acceden a hilos internos.")
    _ensure_target_visible(membership, target_type, target_id)
    return InternalContextThread.objects.create(
        target_type=target_type, target_id=target_id, title=title,
        tenant_id=membership.tenant_id,
    )


def list_threads(membership, target_type: str, target_id):
    if membership.role == R.FAMILY_CLIENT:
        raise PermissionDenied("Los familiares no acceden a hilos internos.")
    _ensure_target_visible(membership, target_type, target_id)
    return InternalContextThread.objects.filter(target_type=target_type, target_id=target_id)


def add_comment(membership, thread_id, body: str) -> InternalComment:
    if membership.role == R.FAMILY_CLIENT:
        raise PermissionDenied("Los familiares no acceden a hilos internos.")
    thread = InternalContextThread.objects.filter(pk=thread_id).first()
    if thread is None:
        raise NotFound("Hilo no encontrado.")
    _ensure_target_visible(membership, thread.target_type, thread.target_id)
    return InternalComment.objects.create(
        thread=thread, author=membership.user, body=body.strip(), tenant_id=membership.tenant_id,
    )


# ---------------------------------------------------------------------------
# Soporte global (tenant <-> AJR Data)
# ---------------------------------------------------------------------------
def send_support_message(membership, body: str, known_names: list[str] | None = None) -> SupportMessage:
    if membership.role == R.FAMILY_CLIENT:
        raise PermissionDenied("El soporte está disponible para el personal de la agencia.")
    clean = sanitize_support_text(body, known_names)
    return SupportMessage.objects.create(
        author=membership.user, body=clean, tenant_id=membership.tenant_id,
    )


def platform_support_inbox():
    """Bandeja de soporte para AJR Data. Solo contiene texto sanitizado; no datos clínicos."""
    return SupportMessage.unscoped.select_related("author").order_by("-created_at")[:200]
