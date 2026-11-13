"""Pruebas de inmutabilidad de registros legales (sin base de datos)."""
from unittest import TestCase

from core.exceptions import ImmutableRecordError
from legal.models import LegalAcceptanceLog


class ImmutableRecordTests(TestCase):
    def test_existing_record_cannot_be_saved(self):
        log = LegalAcceptanceLog()
        log._state.adding = False
        with self.assertRaises(ImmutableRecordError):
            log.save()

    def test_record_cannot_be_deleted(self):
        log = LegalAcceptanceLog()
        with self.assertRaises(ImmutableRecordError):
            log.delete()

    def test_record_cannot_be_soft_deleted(self):
        log = LegalAcceptanceLog()
        with self.assertRaises(ImmutableRecordError):
            log.soft_delete()
