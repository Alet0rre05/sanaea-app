"""Contexto del tenant activo por petición.

Se guarda en una `ContextVar`, por lo que es seguro en entornos asíncronos
y con hilos. El `TenantMiddleware` lo reinicia en cada petición para evitar
fugas de datos entre agencias.

Quien autentica al usuario (capa de autenticación DRF, Fase 2) es responsable
de llamar a `set_current_tenant_id()` con el tenant del usuario autenticado.
"""
from contextlib import contextmanager
from contextvars import ContextVar

_current_tenant_id: ContextVar = ContextVar("current_tenant_id", default=None)


def get_current_tenant_id():
    return _current_tenant_id.get()


def set_current_tenant_id(tenant_id):
    """Establece el tenant activo y devuelve el token para restaurarlo."""
    return _current_tenant_id.set(tenant_id)


def reset_current_tenant_id(token) -> None:
    _current_tenant_id.reset(token)


@contextmanager
def tenant_scope(tenant_id):
    """Ejecuta un bloque con un tenant activo (útil en servicios, tareas y tests)."""
    token = set_current_tenant_id(tenant_id)
    try:
        yield
    finally:
        reset_current_tenant_id(token)
