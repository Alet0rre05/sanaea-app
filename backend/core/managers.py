from django.db import models

from core.tenant_context import get_current_tenant_id


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(is_deleted=False)


class TenantQuerySet(SoftDeleteQuerySet):
    pass


class TenantManager(models.Manager):
    """Manager por defecto de los modelos multi-tenant.

    - Excluye registros con soft delete (`is_deleted=True`).
    - Filtra por el tenant activo del contexto.
    - Sin tenant activo devuelve `none()` (fail-closed).

    `queryset_class` permite especializar el queryset (p. ej. inmutable) sin
    perder el filtrado por tenant.
    """

    queryset_class = TenantQuerySet

    def get_queryset(self):
        queryset = self.queryset_class(self.model, using=self._db).filter(is_deleted=False)
        tenant_id = get_current_tenant_id()
        if tenant_id is None:
            return queryset.none()
        return queryset.filter(tenant_id=tenant_id)
