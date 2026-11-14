"""Pruebas de contraseñas, OTP y tokens. Las reglas de contraseña no requieren base de datos."""
from datetime import timedelta
from unittest import TestCase

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from iam.validators import (
    MinLength15Validator, NoTripleRepeatValidator, has_triple_repeat, password_checks,
)


class TripleRepeatRuleTests(SimpleTestCase):
    def test_blocks_three_identical_consecutive(self):
        self.assertTrue(has_triple_repeat("abcaaadef-long-password"))

    def test_allows_two_identical_consecutive(self):
        self.assertFalse(has_triple_repeat("abcaadef-long-password"))

    def test_non_consecutive_repeats_allowed(self):
        self.assertFalse(has_triple_repeat("a-b-a-b-a-b-a-b-a-b-a-b"))

    def test_checks_report_both_rules(self):
        checks = password_checks("aaa")
        self.assertFalse(checks["min_length"])
        self.assertFalse(checks["no_triple_repeat"])


class PasswordValidatorTests(SimpleTestCase):
    def test_min_length_15(self):
        with self.assertRaises(ValidationError):
            MinLength15Validator().validate("x" * 14)
        MinLength15Validator().validate("Clave-segura-15!")

    def test_triple_repeat_validator(self):
        with self.assertRaises(ValidationError):
            NoTripleRepeatValidator().validate("Clave-Segura-1111x")
        NoTripleRepeatValidator().validate("Clave-Segura-1212-xyz")


class TokenTests(SimpleTestCase):
    @override_settings(JWT_SIGNING_KEY="test-signing-key-with-enough-length-123456",
                       JWT_ACCESS_TOKEN_MINUTES=15)
    def test_access_token_roundtrip_and_type_check(self):
        import jwt
        from django.conf import settings
        from rest_framework.exceptions import AuthenticationFailed
        from iam import tokens

        now = timezone.now()
        payload = {"sub": "u1", "typ": "access", "iat": now,
                   "exp": now + timedelta(minutes=15), "jti": "j1"}
        token = jwt.encode(payload, settings.JWT_SIGNING_KEY, algorithm="HS256")
        self.assertEqual(tokens.decode(token, "access")["sub"], "u1")
        with self.assertRaises(AuthenticationFailed):
            tokens.decode(token, "refresh")
