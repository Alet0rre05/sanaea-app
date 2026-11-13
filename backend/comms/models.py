from django.db import models

from core.models import TenantAwareModel
from core.utils.crypto import EncryptedTextField
from iam.models import CustomUser


class ScopedVisitChat(TenantAwareModel):
    """Chat operativo de una visita. Participantes: prestador asignado y familiar vinculado.
    Solo permite escribir 2 horas antes y después de la visita."""

    visit = models.OneToOneField("operations.Visit", on_delete=models.PROTECT, related_name="chat")


class ChatMessage(TenantAwareModel):
    chat = models.ForeignKey(ScopedVisitChat, on_delete=models.PROTECT, related_name="messages")
    author = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name="+")
    body = EncryptedTextField()

    class Meta:
        ordering = ["created_at"]


class ContextTargetType(models.TextChoices):
    SCAN = "SCAN", "Planilla"
    SETTLEMENT = "SETTLEMENT", "Liquidación"


class InternalContextThread(TenantAwareModel):
    """Hilo de comentarios internos sobre una planilla o una liquidación."""

    target_type = models.CharField(max_length=16, choices=ContextTargetType.choices)
    target_id = models.UUIDField()
    title = models.CharField(max_length=200, blank=True)

    class Meta:
        indexes = [models.Index(fields=["tenant", "target_type", "target_id"])]


class InternalComment(TenantAwareModel):
    thread = models.ForeignKey(InternalContextThread, on_delete=models.PROTECT,
                               related_name="comments")
    author = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name="+")
    body = EncryptedTextField()

    class Meta:
        ordering = ["created_at"]


class SupportMessage(TenantAwareModel):
    """Mensaje del tenant a AJR Data. El texto se sanitiza antes de guardarse
    (sin correos, teléfonos ni documentos)."""

    author = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name="+")
    body = models.TextField()
