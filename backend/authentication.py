"""Autenticación JWT para DRF y selección de agencia activa.

Cabeceras:
  Authorization: Bearer <access>
  X-Tenant-ID: <uuid de la agencia>   (obligatoria para recursos de agencia)

Si se envía `X-Tenant-ID`, se valida que el usuario tenga una membresía activa
en esa agencia y se fija el tenant activo del contexto (`core.tenant_context`).
"""
from django.utils.encoding import force_str
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed

from core.tenant_context import set_current_tenant_id
from iam import tokens
from iam.models import CustomUser, Membership


class JWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header or force_str(header[0]).lower() != self.keyword.lower():
            return None
        if len(header) != 2:
            raise AuthenticationFailed("Cabecera Authorization inválida.")

        payload = tokens.decode(force_str(header[1]), "access")
        user = CustomUser.objects.filter(pk=payload["sub"], is_active=True).first()
        if user is None:
            raise AuthenticationFailed("Usuario inactivo.")

        request.membership = None
        tenant_header = request.META.get("HTTP_X_TENANT_ID")
        if tenant_header:
            membership = (
                Membership.objects.select_related("tenant")
                .filter(user=user, tenant_id=tenant_header)
                .first()
            )
            if membership is None or not membership.is_usable:
                raise AuthenticationFailed("Sin acceso a la agencia indicada.")
            set_current_tenant_id(membership.tenant_id)
            request.membership = membership

        return (user, payload)

    def authenticate_header(self, request):
        return self.keyword
