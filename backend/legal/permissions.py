from rest_framework.permissions import BasePermission

from legal.services import pending_documents


class LegalAcceptedRequired(BasePermission):
    """Bloquea operaciones si quedan documentos requeridos sin aceptar."""

    message = {"code": "legal_pending", "detail": "Debés aceptar los documentos legales vigentes."}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return not pending_documents(user)
