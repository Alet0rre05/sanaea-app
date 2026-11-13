"""Aislamiento multi-tenant sobre modelos reales. Requiere base de datos."""
from django.test import TestCase

from core.exceptions import CrossTenantWriteError
from core.models import Tenant
from core.tenant_context import tenant_scope
from operations.models import Patient


class TenantIsolationTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Agencia A", slug="agencia-a")
        self.tenant_b = Tenant.objects.create(name="Agencia B", slug="agencia-b")
        with tenant_scope(self.tenant_a.pk):
            self.patient_a = Patient.objects.create(
                full_name="Paciente A", document_number="111", address="Calle 1",
            )

    def test_fail_closed_without_tenant(self):
        self.assertEqual(Patient.objects.count(), 0)

    def test_other_tenant_cannot_see_record(self):
        with tenant_scope(self.tenant_b.pk):
            self.assertFalse(Patient.objects.filter(pk=self.patient_a.pk).exists())

    def test_owner_tenant_sees_record(self):
        with tenant_scope(self.tenant_a.pk):
            self.assertEqual(Patient.objects.count(), 1)

    def test_unscoped_manager_bypasses_filter(self):
        self.assertEqual(Patient.unscoped.filter(pk=self.patient_a.pk).count(), 1)

    def test_cross_tenant_write_rejected(self):
        with tenant_scope(self.tenant_b.pk):
            patient = Patient.unscoped.get(pk=self.patient_a.pk)
            patient.full_name = "Intento de escritura cruzada"
            with self.assertRaises(CrossTenantWriteError):
                patient.save()

    def test_soft_delete_hides_record(self):
        with tenant_scope(self.tenant_a.pk):
            self.patient_a.soft_delete()
            self.assertEqual(Patient.objects.count(), 0)
        self.assertEqual(Patient.unscoped.filter(pk=self.patient_a.pk, is_deleted=True).count(), 1)

    def test_encrypted_fields_roundtrip(self):
        with tenant_scope(self.tenant_a.pk):
            fresh = Patient.objects.get(pk=self.patient_a.pk)
            self.assertEqual(fresh.full_name, "Paciente A")
            self.assertEqual(fresh.document_number, "111")
