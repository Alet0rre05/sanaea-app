"""Cifrado a nivel de campo para datos sensibles (PHI).

Implementación basada en Fernet (cryptography): AES en modo CBC con
autenticación HMAC-SHA256. La clave se toma de `settings.FIELD_ENCRYPTION_KEY`.

Limitaciones conocidas (ver README, sección "Decisiones abiertas"):
  - Un campo cifrado no puede usarse en filtros SQL de igualdad, ordenamiento
    ni búsquedas parciales: el valor en base de datos es un token no determinista.
  - La rotación de claves requiere re-cifrar los registros existentes.
"""
from functools import lru_cache

from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


@lru_cache(maxsize=4)
def _get_fernet(key: str) -> Fernet:
    return Fernet(key.encode() if isinstance(key, str) else key)


def get_fernet() -> Fernet:
    key = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
    if not key:
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEY no está configurada.")
    return _get_fernet(key)


def encrypt_text(plain: str) -> str:
    return get_fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_text(token: str) -> str:
    return get_fernet().decrypt(token.encode("ascii")).decode("utf-8")


class EncryptedTextField(models.TextField):
    """TextField que almacena su contenido cifrado con Fernet."""

    description = "Texto cifrado a nivel de campo (Fernet)"

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None:
            return None
        return encrypt_text(str(value))

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        return decrypt_text(value)
