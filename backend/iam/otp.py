"""Códigos OTP de un solo uso enviados por correo.

- Se guarda solo el HMAC-SHA256 del código (ligado a propósito y usuario).
- Expiran en `OTP_EXPIRY_MINUTES`.
- Máximo `OTP_MAX_ATTEMPTS` intentos por código.
- Un nuevo código del mismo propósito invalida los anteriores.
"""
import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from iam.models import CustomUser, OneTimeCode, OTPPurpose

SUBJECTS = {
    OTPPurpose.REGISTER_VERIFY: "Verificá tu cuenta",
    OTPPurpose.PASSWORD_RESET: "Recuperación de contraseña",
    OTPPurpose.EMAIL_CHANGE: "Confirmá tu nuevo email",
    OTPPurpose.BACKUP_EMAIL_CHANGE: "Confirmá tu email de respaldo",
    OTPPurpose.USERNAME_CHANGE: "Confirmá el cambio de username",
    OTPPurpose.FAMILY_LINK_VERIFY: "Verificación de vínculo con el paciente",
}


def _hash(code: str, purpose: str, user_id, target: str) -> str:
    message = f"{purpose}|{user_id}|{target}|{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def issue(user: CustomUser, purpose: str, send_to: str, target: str = "") -> str:
    """Genera y envía un código a `send_to`. `target` es el valor que se confirma."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        OneTimeCode.objects.filter(
            user=user, purpose=purpose, consumed_at__isnull=True
        ).update(consumed_at=timezone.now())
        OneTimeCode.objects.create(
            user=user,
            purpose=purpose,
            target=target,
            code_hash=_hash(code, purpose, user.pk, target),
            expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
        )
    send_mail(
        subject=SUBJECTS[purpose],
        message=(
            f"Tu código es: {code}\n"
            f"Vence en {settings.OTP_EXPIRY_MINUTES} minutos. "
            "Si no lo solicitaste, ignorá este mensaje."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[send_to],
    )
    return code


def verify(user: CustomUser, purpose: str, code: str, target: str = "") -> bool:
    """Valida el código. Consume el OTP si es correcto."""
    with transaction.atomic():
        record = (
            OneTimeCode.objects.select_for_update()
            .filter(user=user, purpose=purpose, target=target, consumed_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if record is None or record.expires_at <= timezone.now():
            return False
        if record.attempts >= settings.OTP_MAX_ATTEMPTS:
            record.consumed_at = timezone.now()
            record.save(update_fields=["consumed_at", "updated_at"])
            return False

        record.attempts += 1
        expected = _hash(code or "", purpose, user.pk, target)
        ok = hmac.compare_digest(expected, record.code_hash)
        if ok:
            record.consumed_at = timezone.now()
        record.save(update_fields=["attempts", "consumed_at", "updated_at"])
        return ok
