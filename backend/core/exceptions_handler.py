"""Respuestas de error estandarizadas para toda la API.

Formato:
    {"error": {"code": "...", "message": "...", "details": ...}}
"""
import logging

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler

from core.exceptions import CrossTenantWriteError, TenantNotSetError
from core.telemetry import sanitize

logger = logging.getLogger("core.api")


def standard_exception_handler(exc, context):
    if isinstance(exc, CrossTenantWriteError):
        return _build(status.HTTP_403_FORBIDDEN, "cross_tenant_write", str(exc))
    if isinstance(exc, TenantNotSetError):
        return _build(status.HTTP_403_FORBIDDEN, "tenant_not_set", str(exc))

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("Error no controlado en la API", extra={"view": str(context.get("view"))})
        return _build(status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error",
                      "Error interno del servidor.")

    code = getattr(exc, "default_code", "error")
    message = exc.detail if isinstance(exc, APIException) and isinstance(exc.detail, str) else (
        "Solicitud inválida." if response.status_code == 400 else str(exc.__class__.__name__)
    )
    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": sanitize(response.data) if response.status_code == 400 else None,
        }
    }
    return response


def _build(http_status, code, message):
    from rest_framework.response import Response

    return Response({"error": {"code": code, "message": message, "details": None}},
                    status=http_status)
