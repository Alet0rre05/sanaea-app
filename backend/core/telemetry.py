"""Telemetría sanitizada: ningún dato personal o de salud llega a los logs.

Las claves listadas en PHI_KEYS se reemplazan por "[REDACTED]" en cualquier
nivel de anidamiento. Los valores de texto que parecen DNI, teléfonos o correos
también se enmascaran.
"""
import logging
import re

REDACTED = "[REDACTED]"

PHI_KEYS = frozenset({
    "password", "new_password", "code", "token", "access", "refresh",
    "full_name", "first_name", "last_name", "document_number", "address",
    "text", "body", "signature_data", "extracted_data", "email",
    "backup_email", "username", "license_number", "image", "phone",
})

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_DNI_RE = re.compile(r"\b\d{7,8}\b")
_PHONE_RE = re.compile(r"\+?\d[\d\s-]{7,}\d")


def mask_text(value: str) -> str:
    value = _EMAIL_RE.sub(REDACTED, value)
    value = _PHONE_RE.sub(REDACTED, value)
    return _DNI_RE.sub(REDACTED, value)


def sanitize(data):
    if isinstance(data, dict):
        return {
            k: (REDACTED if str(k).lower() in PHI_KEYS else sanitize(v))
            for k, v in data.items()
        }
    if isinstance(data, (list, tuple)):
        return [sanitize(item) for item in data]
    if isinstance(data, str):
        return mask_text(data)
    return data


class PHIRedactionFilter(logging.Filter):
    """Filtro de logging: enmascara el mensaje final y los argumentos."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = mask_text(str(record.getMessage()))
            record.args = ()
        except Exception:  # nunca romper el logging por el filtro
            record.msg = REDACTED
            record.args = ()
        return True


def log_event(logger: logging.Logger, event: str, **fields) -> None:
    """Registra un evento con campos sanitizados."""
    logger.info("%s %s", event, sanitize(fields))
