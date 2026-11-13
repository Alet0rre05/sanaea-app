"""Modelos base del sistema.

- BaseAuditModel: clave UUIDv7, auditoría y soft delete.
- TenantAwareModel: hereda de BaseAuditModel y aísla los datos por `tenant`.
- Tenant: agencia cliente de la plataforma.
"""
from django.db import models

from core.exceptions import CrossTenantWriteError
from core.managers import SoftDeleteQuerySet, TenantManager
from core.tenant_context import get_current_tenant_id
from core.utils.ids import uuid7


class BaseAuditModel(models.Model):
    """Base abstracta con auditoría y soft delete.

    `created_by` guarda el UUID del usuario creador. En la Fase 2 se convertirá
    en clave foránea hacia `iam.CustomUser` cuando exista ese modelo.
    """

    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.UUIDField(null=True, blank=True, editable=False)
    is_deleted = models.BooleanField(default=False, db_index=True)

    objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    def soft_delete(self) -> None:
        """Marca el registro como eliminado sin borrarlo físicamente."""
        self.is_deleted = True
        self.save(update_fields=["is_deleted", "updated_at"])


class Tenant(BaseAuditModel):
    """Agencia cliente de la plataforma. Raíz del aislamiento multi-tenant."""

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "tenant"
        verbose_name_plural = "tenants"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class TenantAwareModel(BaseAuditModel):
    """Modelo abstracto para todos los datos de una agencia.

    Garantías:
    - Las consultas por defecto (`objects`) solo devuelven datos del tenant activo.
    - Al guardar con un tenant activo, el registro se asigna a ese tenant y
      no se permite escribir datos de otro tenant (`CrossTenantWriteError`).
    - `unscoped` no aplica filtro de tenant. Debe usarse únicamente en procesos
      de plataforma (migraciones de datos, auditoría interna) nunca en vistas.
    """

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="+",
        db_index=True,
    )

    objects = TenantManager()
    unscoped = models.Manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        current_tenant_id = get_current_tenant_id()
        if current_tenant_id is not None:
            if self.tenant_id is None:
                self.tenant_id = current_tenant_id
            elif str(self.tenant_id) != str(current_tenant_id):
                raise CrossTenantWriteError(
                    "Intento de escribir un registro de otro tenant."
                )
        super().save(*args, **kwargs)
