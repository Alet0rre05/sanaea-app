"""Casos de uso de identidad: registro, recuperación y cambios sensibles.

Las vistas solo validan y serializan; la lógica vive aquí.
"""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from iam import otp, tokens
from iam.models import CustomUser, Membership, OTPPurpose, TenantRole

SENSITIVE_FIELDS = {
    "email": OTPPurpose.EMAIL_CHANGE,
    "backup_email": OTPPurpose.BACKUP_EMAIL_CHANGE,
    "username": OTPPurpose.USERNAME_CHANGE,
}


def _validate_password_or_raise(password: str, user=None) -> None:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise ValidationError({"new_password": list(exc.messages)})


def register(email: str, password: str, first_name: str = "", last_name: str = "") -> None:
    """Crea un usuario inactivo y envía el OTP de verificación.

    Si el email ya existe no se revela nada: se responde igual que en un alta
    nueva (evita la enumeración de cuentas).
    """
    email = email.strip().lower()
    if CustomUser.objects.filter(email=email).exists():
        return
    _validate_password_or_raise(password)
    with transaction.atomic():
        user = CustomUser(email=email, first_name=first_name, last_name=last_name)
        user.set_password(password)
        user.save()
    otp.issue(user, OTPPurpose.REGISTER_VERIFY, send_to=email)


def verify_registration(email: str, code: str) -> bool:
    user = CustomUser.objects.filter(email=email.strip().lower(), is_active=False).first()
    if user is None:
        return False
    if not otp.verify(user, OTPPurpose.REGISTER_VERIFY, code):
        return False
    user.is_active = True
    user.save(update_fields=["is_active", "updated_at"])
    return True


def request_password_reset(email: str) -> None:
    """Responde siempre igual (no revela si la cuenta existe)."""
    user = CustomUser.objects.filter(email=email.strip().lower(), is_active=True).first()
    if user is not None:
        otp.issue(user, OTPPurpose.PASSWORD_RESET, send_to=user.email)


def confirm_password_reset(email: str, code: str, new_password: str) -> bool:
    user = CustomUser.objects.filter(email=email.strip().lower(), is_active=True).first()
    if user is None or not otp.verify(user, OTPPurpose.PASSWORD_RESET, code):
        return False
    _validate_password_or_raise(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    tokens.revoke_all_for_user(user)
    return True


def request_sensitive_change(user: CustomUser, field: str, value: str) -> None:
    """Inicia un cambio de email, email de respaldo o username con OTP.

    - email: el código se envía al nuevo email.
    - backup_email: el código se envía al nuevo email de respaldo.
    - username: el código se envía al email actual de la cuenta.
    """
    purpose = _purpose_for(field)
    value = _normalize(field, value)
    _ensure_available(field, value, user)
    send_to = user.email if field == "username" else value
    otp.issue(user, purpose, send_to=send_to, target=value)


def confirm_sensitive_change(user: CustomUser, field: str, value: str, code: str) -> None:
    purpose = _purpose_for(field)
    value = _normalize(field, value)
    _ensure_available(field, value, user)
    if not otp.verify(user, purpose, code, target=value):
        raise ValidationError({"code": ["Código inválido o vencido."]})
    setattr(user, field, value)
    user.save(update_fields=[field, "updated_at"])


def _purpose_for(field: str) -> str:
    if field not in SENSITIVE_FIELDS:
        raise ValidationError({"field": ["Campo no permitido."]})
    return SENSITIVE_FIELDS[field]


def _normalize(field: str, value: str) -> str:
    value = (value or "").strip()
    return value.lower() if field in {"email", "backup_email"} else value


def _ensure_available(field: str, value: str, user: CustomUser) -> None:
    if field == "email":
        taken = CustomUser.objects.filter(email=value).exclude(pk=user.pk).exists()
    elif field == "username":
        taken = CustomUser.objects.filter(username=value).exclude(pk=user.pk).exists()
    else:
        taken = False
    if taken:
        raise ValidationError({field: ["Ya está en uso."]})


def create_membership(actor: Membership, tenant_id, email: str, role: str,
                      license_number: str = "") -> Membership:
    """Asigna un usuario existente a una agencia.

    Reglas:
      - Solo OWNER puede crear otro OWNER.
      - El usuario debe existir y estar verificado.
      - Un usuario tiene una sola membresía por agencia (restricción de BD).
    """
    if str(actor.tenant_id) != str(tenant_id):
        raise ValidationError({"tenant": ["La agencia no coincide con la sesión activa."]})
    if role == TenantRole.OWNER and actor.role != TenantRole.OWNER:
        raise ValidationError({"role": ["Solo un propietario puede asignar propietarios."]})

    user = CustomUser.objects.filter(email=email.strip().lower(), is_active=True).first()
    if user is None:
        raise ValidationError({"email": ["No existe un usuario verificado con ese email."]})
    if Membership.objects.filter(user=user, tenant_id=tenant_id).exists():
        raise ValidationError({"email": ["El usuario ya pertenece a esta agencia."]})

    return Membership.objects.create(
        user=user,
        tenant_id=tenant_id,
        role=role,
        license_number=license_number,
        created_by=actor.user_id,
    )
