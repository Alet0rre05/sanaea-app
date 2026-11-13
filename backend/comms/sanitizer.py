"""Sanitización automática de mensajes de soporte.

Enmascara correos, teléfonos, números de documento y los nombres de pacientes
que se pasen explícitamente. Es una protección básica: no reemplaza la revisión
humana ni detecta todo dato sensible en texto libre.
"""
import re

from core.telemetry import REDACTED, mask_text


def sanitize_support_text(body: str, known_names: list[str] | None = None) -> str:
    text = mask_text(body or "")
    for name in known_names or []:
        name = (name or "").strip()
        if len(name) >= 3:
            text = re.sub(re.escape(name), REDACTED, text, flags=re.IGNORECASE)
    return text
