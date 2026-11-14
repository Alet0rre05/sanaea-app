"""Permisos por rol de agencia y de plataforma.

Principio de privacidad inversa: cada recurso declara explícitamente qué roles
pueden verlo. Los roles de prestador y familiar además se limitan a sus
pacientes mediante filtros de queryset (ver operations.scoping).
"""
from rest_framework.permissions import BasePermission

from iam.models import TenantRole as R

# --- Conjuntos de roles por recurso ----------------------------------------
AGENCY_ADMIN = frozenset({R.OWNER, R.ADMIN})
BILLING = frozenset({R.OWNER, R.ADMIN, R.LIQUIDATOR})            # tarifas, liquidaciones
VISIT_SUMMARY = frozenset({R.OWNER, R.ADMIN, R.LIQUIDATOR,
                           R.MEDICAL_AUDITOR, R.PROVIDER})         # resumen de visita
MEDICAL_HISTORY = frozenset({R.MEDICAL_AUDITOR, R.PROVIDER})       # evoluciones (PROVIDER: solo propias)
SCANS = frozenset({R.OWNER, R.ADMIN, R.LIQUIDATOR, R.PROVIDER})    # planillas (PROVIDER: solo propias)
PATIENTS = frozenset({R.OWNER, R.ADMIN, R.LIQUIDATOR,
                      R.MEDICAL_AUDITOR, R.PROVIDER})
CHAT_PARTICIPANTS = frozenset({R.PROVIDER, R.FAMILY_CLIENT})       # chat operativo (filtro extra en servicio)


class IsPlatformStaff(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_platform_staff)


class IsPlatformSuperadmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.platform_role == "PLATFORM_SUPERADMIN")


class HasTenantRole(BasePermission):
    """Exige una membresía activa en la agencia de la cabecera X-Tenant-ID
    cuyo rol pertenezca a `view.allowed_roles`."""

    message = "No tenés permiso para este recurso en la agencia activa."

    def has_permission(self, request, view):
        membership = getattr(request, "membership", None)
        allowed = getattr(view, "allowed_roles", frozenset())
        return membership is not None and membership.role in allowed
