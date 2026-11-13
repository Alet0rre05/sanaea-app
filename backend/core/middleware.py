from core.tenant_context import reset_current_tenant_id, set_current_tenant_id


class TenantMiddleware:
    """Aísla el contexto de tenant por petición.

    Al inicio de cada petición el contexto queda en `None`. Con `None` los
    `TenantManager` devuelven un queryset vacío (comportamiento fail-closed):
    ninguna consulta de datos de tenant puede ejecutarse sin un tenant explícito.

    La resolución del tenant a partir de la identidad autenticada se completa
    en la Fase 2 (app `iam`).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = set_current_tenant_id(None)
        try:
            return self.get_response(request)
        finally:
            reset_current_tenant_id(token)
