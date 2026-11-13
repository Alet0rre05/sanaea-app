"""Verificación de Cloudflare Turnstile en login, registro y recuperación.

Falla cerrada: ante cualquier error de red o respuesta inválida, se rechaza.
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger("iam.turnstile")


def verify_turnstile(token: str, remote_ip: str | None = None) -> bool:
    if not token:
        return False
    payload = urllib.parse.urlencode({
        "secret": settings.TURNSTILE_SECRET_KEY,
        "response": token,
        "remoteip": remote_ip or "",
    }).encode()
    request = urllib.request.Request(settings.TURNSTILE_VERIFY_URL, data=payload, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310 (URL fija de config)
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError):
        logger.warning("Fallo al verificar Turnstile; se rechaza por seguridad.")
        return False
    return bool(body.get("success"))


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")
