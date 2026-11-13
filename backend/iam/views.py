"""Endpoints de identidad y agencias. Solo validan, serializan y delegan en services."""
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, CreateAPIView

from core.models import Tenant
from iam import services, tokens
from iam.models import Membership, TenantRole
from iam.permissions import AGENCY_ADMIN, HasTenantRole, IsPlatformSuperadmin
from iam.serializers import (
    LoginSerializer, MembershipCreateSerializer, MembershipSerializer,
    PasswordCheckSerializer, PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer, RegisterSerializer,
    SensitiveChangeConfirmSerializer, SensitiveChangeRequestSerializer,
    TenantSerializer, UserSerializer, VerifyCodeSerializer,
)
from iam.turnstile import client_ip, verify_turnstile


def _require_turnstile(request):
    if not verify_turnstile(request.data.get("turnstile_token", ""), client_ip(request)):
        raise PermissionDenied("Verificación anti-bot inválida.")


def _set_refresh_cookie(response, token: str) -> None:
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        token,
        max_age=settings.JWT_REFRESH_TOKEN_DAYS * 86400,
        httponly=True,
        secure=True,
        samesite="None",
        path="/api/v1/auth/",
    )


class PublicAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]


class RegisterView(PublicAPIView):
    def post(self, request):
        _require_turnstile(request)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.register(**serializer.validated_data)
        return Response({"detail": "Revisá tu correo para verificar la cuenta."},
                        status=status.HTTP_202_ACCEPTED)


class VerifyRegistrationView(PublicAPIView):
    def post(self, request):
        _require_turnstile(request)
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ok = services.verify_registration(**serializer.validated_data)
        if not ok:
            raise ValidationError({"code": ["Código inválido o vencido."]})
        return Response({"detail": "Cuenta verificada."})


class LoginView(PublicAPIView):
    def post(self, request):
        _require_turnstile(request)
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from iam.models import CustomUser
        user = CustomUser.objects.filter(email=serializer.validated_data["email"].lower()).first()
        if user is None or not user.is_active or not user.check_password(
            serializer.validated_data["password"]
        ):
            # Mensaje genérico: no se revela si el email existe.
            raise AuthenticationFailed("Credenciales inválidas.")
        refresh = tokens.issue_refresh_token(user)
        response = Response({"access": tokens.issue_access_token(user),
                             "user": UserSerializer(user).data})
        _set_refresh_cookie(response, refresh)
        return response


class RefreshView(PublicAPIView):
    def post(self, request):
        token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not token:
            raise AuthenticationFailed("Sesión no encontrada.")
        user, access, refresh = tokens.rotate_refresh_token(token)
        response = Response({"access": access})
        _set_refresh_cookie(response, refresh)
        return response


class LogoutView(PublicAPIView):
    def post(self, request):
        token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if token:
            try:
                payload = tokens.decode(token, "refresh")
                import uuid
                tokens.revoke_family(uuid.UUID(payload["fam"]))
            except AuthenticationFailed:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.JWT_REFRESH_COOKIE_NAME, path="/api/v1/auth/",
                               samesite="None")
        return response


class PasswordCheckView(PublicAPIView):
    def post(self, request):
        serializer = PasswordCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.to_representation(serializer.validated_data))


class PasswordResetRequestView(PublicAPIView):
    def post(self, request):
        _require_turnstile(request)
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(serializer.validated_data["email"])
        return Response({"detail": "Si la cuenta existe, recibirás un código."},
                        status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(PublicAPIView):
    def post(self, request):
        _require_turnstile(request)
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        ok = services.confirm_password_reset(data["email"], data["code"], data["new_password"])
        if not ok:
            raise ValidationError({"code": ["Código inválido o vencido."]})
        return Response({"detail": "Contraseña actualizada."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class SensitiveChangeRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SensitiveChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_sensitive_change(request.user, **serializer.validated_data)
        return Response({"detail": "Código enviado."}, status=status.HTTP_202_ACCEPTED)


class SensitiveChangeConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SensitiveChangeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.confirm_sensitive_change(request.user, **serializer.validated_data)
        return Response(UserSerializer(request.user).data)


class TenantListView(ListAPIView):
    """Agencias del usuario autenticado (para el selector de agencia activa)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MembershipSerializer

    def get_queryset(self):
        return Membership.objects.select_related("tenant").filter(
            user=self.request.user, membership_active=True, is_deleted=False,
            tenant__is_active=True,
        )


class PlatformTenantCreateView(CreateAPIView):
    permission_classes = [IsAuthenticated, IsPlatformSuperadmin]
    serializer_class = TenantSerializer

    def perform_create(self, serializer):
        serializer.save()


class TenantMembershipsView(APIView):
    """Asigna usuarios verificados a la agencia activa (OWNER / ADMIN)."""
    permission_classes = [IsAuthenticated, HasTenantRole]
    allowed_roles = AGENCY_ADMIN

    def post(self, request, tenant_id):
        serializer = MembershipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = services.create_membership(
            request.membership, tenant_id, **serializer.validated_data
        )
        return Response(MembershipSerializer(membership).data,
                        status=status.HTTP_201_CREATED)
