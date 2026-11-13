"""Pruebas de comunicaciones sin base de datos."""
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest import TestCase

from comms.sanitizer import sanitize_support_text
from comms.policy import is_chat_open


class ChatWindowTests(TestCase):
    def setUp(self):
        start = datetime(2026, 11, 10, 9, 0)
        self.visit = SimpleNamespace(scheduled_start=start, scheduled_end=start + timedelta(hours=1))

    def test_closed_more_than_two_hours_before(self):
        self.assertFalse(is_chat_open(self.visit, now=datetime(2026, 11, 10, 6, 59)))

    def test_open_two_hours_before(self):
        self.assertTrue(is_chat_open(self.visit, now=datetime(2026, 11, 10, 7, 0)))

    def test_open_during_visit(self):
        self.assertTrue(is_chat_open(self.visit, now=datetime(2026, 11, 10, 9, 30)))

    def test_open_two_hours_after_end(self):
        self.assertTrue(is_chat_open(self.visit, now=datetime(2026, 11, 10, 12, 0)))

    def test_closed_after_window(self):
        self.assertFalse(is_chat_open(self.visit, now=datetime(2026, 11, 10, 12, 1)))


class SupportSanitizerTests(TestCase):
    def test_masks_email_phone_and_document(self):
        text = sanitize_support_text(
            "Escribime a juan.perez@mail.com o al +54 11 4567-8901, DNI 30123456"
        )
        self.assertNotIn("juan.perez@mail.com", text)
        self.assertNotIn("30123456", text)
        self.assertIn("[REDACTED]", text)

    def test_masks_known_patient_names(self):
        text = sanitize_support_text("El paciente Ana Gómez no responde", ["Ana Gómez"])
        self.assertNotIn("Ana Gómez", text)

    def test_keeps_plain_text(self):
        self.assertEqual(sanitize_support_text("Error al cargar la planilla"),
                         "Error al cargar la planilla")
