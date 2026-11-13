"""Pruebas del núcleo sin dependencias de dominio: UUIDv7, cifrado y contexto de tenant.

Las pruebas de aislamiento sobre modelos reales están en operations/tests/test_isolation.py.
"""
import time
import uuid
from unittest import TestCase

from core.tenant_context import get_current_tenant_id, tenant_scope
from core.utils.crypto import decrypt_text, encrypt_text
from core.utils.ids import uuid7


class UUIDv7Tests(TestCase):
    def test_version_and_variant(self):
        value = uuid7()
        self.assertEqual(value.version, 7)
        self.assertEqual(value.variant, uuid.RFC_4122)

    def test_ordered_across_milliseconds(self):
        first = uuid7()
        time.sleep(0.005)
        second = uuid7()
        self.assertLess(str(first), str(second))


class CryptoTests(TestCase):
    def test_roundtrip_and_ciphertext_hides_plaintext(self):
        token = encrypt_text("Evolución de prueba")
        self.assertNotIn("Evolución", token)
        self.assertEqual(decrypt_text(token), "Evolución de prueba")


class TenantContextTests(TestCase):
    def test_default_context_is_none(self):
        self.assertIsNone(get_current_tenant_id())

    def test_scope_restores_previous_value(self):
        marker = uuid7()
        with tenant_scope(marker):
            self.assertEqual(get_current_tenant_id(), marker)
        self.assertIsNone(get_current_tenant_id())
