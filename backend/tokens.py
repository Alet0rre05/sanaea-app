"""Emisión y rotación de JWT.

- Access token: 15 minutos (configurable). Sin tenant embebido: la agencia activa
  se elige por petición con la cabecera `X-Tenant-ID`, validada contra membresías.
- Refresh token: rotativo. Cada uso marca el token como usado y emite uno nuevo
  de la misma familia. La reutilización de un token ya usado revoca la familia.
"""
import datetime as dt
import uuid

import jwt
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

from core.utils.ids import uuid7
from iam.models import CustomUser, RefreshToken

ALGORITHM = "HS256"


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.JWT_SIGNING_KEY, algorithm=ALGORITHM)


def decode(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SIGNING_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "iat", "sub", "typ", "jti"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationFailed("Token inválido o vencido.") from exc
    if payload.get("typ") != expected_type:
        raise AuthenticationFailed("Tipo de token incorrecto.")
    return payload


def issue_access_token(user: CustomUser) -> str:
    now = timezone.now()
    return _encode({
        "sub": str(user.pk),
        "typ": "access",
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.JWT_ACCESS_TOKEN_MINUTES),
        "jti": str(uuid7()),
    })


def issue_refresh_token(user: CustomUser, family: uuid.UUID | None = None) -> str:
    now = timezone.now()
    jti = uuid7()
    family = family or uuid7()
    expires_at = now + dt.timedelta(days=settings.JWT_REFRESH_TOKEN_DAYS)
    RefreshToken.objects.create(
        user=user, jti=jti, family=family, expires_at=expires_at,
    )
    return _encode({
        "sub": str(user.pk),
        "typ": "refresh",
        "iat": now,
        "exp": expires_at,
        "jti": str(jti),
        "fam": str(family),
    })


def rotate_refresh_token(token: str) -> tuple[CustomUser, str, str]:
    """Valida el refresh token, lo marca como usado y devuelve (usuario, access, refresh).

    La revocación por reutilización se confirma FUERA de la transacción de rotación:
    si se hiciera dentro y luego se lanzara una excepción, el rollback la anularía.
    """
    payload = decode(token, "refresh")
    reused_family = None

    with transaction.atomic():
        record = (
            RefreshToken.objects.select_for_update()
            .filter(jti=payload["jti"], user_id=payload["sub"])
            .first()
        )
        if record is None:
            raise AuthenticationFailed("Sesión inválida.")
        if record.revoked_at is not None:
            raise AuthenticationFailed("Sesión revocada.")
        if record.used_at is not None:
            # Reutilización de un token ya rotado: posible robo de sesión.
            reused_family = record.family
        elif record.expires_at <= timezone.now():
            raise AuthenticationFailed("Sesión vencida.")
        else:
            user = CustomUser.objects.filter(pk=record.user_id, is_active=True).first()
            if user is None:
                raise AuthenticationFailed("Usuario inactivo.")
            record.used_at = timezone.now()
            record.save(update_fields=["used_at", "updated_at"])
            new_refresh = issue_refresh_token(user, family=record.family)
            return user, issue_access_token(user), new_refresh

    revoke_family(reused_family)
    raise AuthenticationFailed("Sesión revocada por reutilización de token.")


def revoke_family(family: uuid.UUID) -> None:
    RefreshToken.objects.filter(family=family, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )


def revoke_all_for_user(user: CustomUser) -> None:
    RefreshToken.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )
