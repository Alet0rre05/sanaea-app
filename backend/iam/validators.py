"""Validadores de contraseña.

Reglas del documento maestro:
  - Mínimo 15 caracteres.
  - Prohibido repetir 3 caracteres idénticos consecutivos (regex `(.)\\1\\1`).

Las funciones puras (`has_triple_repeat`, `password_checks`) se usan también
desde la API para que el frontend muestre los checks en tiempo real.
"""
import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

MIN_PASSWORD_LENGTH = 15
TRIPLE_REPEAT_RE = re.compile(r"(.)\1\1", re.DOTALL)


def has_triple_repeat(password: str) -> bool:
    return bool(TRIPLE_REPEAT_RE.search(password or ""))


def password_checks(password: str) -> dict:
    return {
        "min_length": len(password or "") >= MIN_PASSWORD_LENGTH,
        "no_triple_repeat": not has_triple_repeat(password),
    }


class MinLength15Validator:
    def validate(self, password, user=None):
        if len(password or "") < MIN_PASSWORD_LENGTH:
            raise ValidationError(
                _("La contraseña debe tener al menos %(n)d caracteres."),
                code="password_too_short",
                params={"n": MIN_PASSWORD_LENGTH},
            )

    def get_help_text(self):
        return _("Mínimo %(n)d caracteres.") % {"n": MIN_PASSWORD_LENGTH}


class NoTripleRepeatValidator:
    def validate(self, password, user=None):
        if has_triple_repeat(password):
            raise ValidationError(
                _("La contraseña no puede repetir 3 caracteres idénticos consecutivos."),
                code="password_triple_repeat",
            )

    def get_help_text(self):
        return _("No repetir 3 caracteres idénticos consecutivos.")
