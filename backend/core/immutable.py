"""Registros inmutables (log de auditoría legal).

Un modelo inmutable solo admite INSERT. Cualquier UPDATE o DELETE, sea por
instancia, por queryset o por `bulk_*`, lanza `ImmutableRecordError`.
"""
from django.db import models

from core.exceptions import ImmutableRecordError


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ImmutableRecordError("Registro inmutable: no admite UPDATE.")

    def delete(self):
        raise ImmutableRecordError("Registro inmutable: no admite DELETE.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise ImmutableRecordError("Registro inmutable: no admite UPDATE.")


class ImmutableModelMixin(models.Model):
    objects = ImmutableQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableRecordError("Registro inmutable: no admite modificaciones.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError("Registro inmutable: no admite eliminación.")

    def soft_delete(self):
        raise ImmutableRecordError("Registro inmutable: no admite eliminación.")
