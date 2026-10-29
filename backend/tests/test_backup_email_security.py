"""Pruebas unitarias independientes de la base para controles del correo de respaldo.

Ejecutar desde backend/: python -m unittest tests.test_backup_email_security
"""
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/ajr_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-0123456789")
os.environ.setdefault("ENVIRONMENT", "test")

from app.core import email as email_module  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.services.backup_email_crypto import code_digest, generate_code  # noqa: E402
from app.schemas.backup_email import BackupEmailRequest, BackupEmailVerify  # noqa: E402
from app.models.backup_email import BackupEmail  # noqa: E402
from pydantic import ValidationError  # noqa: E402


class BackupEmailSecurityTests(unittest.TestCase):
    def test_only_verified_backup_addresses_have_global_uniqueness(self):
        indexes = {index.name: index for index in BackupEmail.__table__.indexes}
        self.assertFalse(indexes["ix_backup_emails_email"].unique)
        verified_index = indexes["uq_backup_emails_verified_email"]
        self.assertTrue(verified_index.unique)
        self.assertIn("VERIFIED", str(verified_index.dialect_options["postgresql"]["where"]))

    def test_code_is_exactly_six_digits_and_preserves_leading_zeroes(self):
        with patch("app.services.backup_email_crypto.secrets.randbelow", return_value=7):
            self.assertEqual(generate_code(), "000007")
        for _ in range(30):
            self.assertRegex(generate_code(), r"^\d{6}$")

    def test_schema_normalizes_email_and_requires_current_password(self):
        request = BackupEmailRequest(email=" Backup@Example.com ", current_password="current-pass")
        self.assertEqual(str(request.email), "backup@example.com")
        with self.assertRaises(ValidationError):
            BackupEmailRequest(email="not-an-email", current_password="x")
        with self.assertRaises(ValidationError):
            BackupEmailRequest(email="backup@example.com", current_password="x", user_id=123)

    def test_verification_schema_accepts_exactly_six_digits(self):
        self.assertEqual(BackupEmailVerify(code="001234").code, "001234")
        for invalid_code in ("12345", "1234567", "12a456", " 12345"):
            with self.subTest(code=invalid_code), self.assertRaises(ValidationError):
                BackupEmailVerify(code=invalid_code)

    def test_hmac_is_stable_and_bound_to_challenge_user_and_destination(self):
        base = {
            "challenge_id": 12,
            "user_id": 34,
            "target_email": "respaldo@example.com",
            "code": "012345",
        }
        digest = code_digest(**base)
        self.assertEqual(len(digest), 64)
        self.assertNotEqual(digest, base["code"])
        self.assertEqual(digest, code_digest(**base))
        self.assertNotEqual(digest, code_digest(**{**base, "challenge_id": 13}))
        self.assertNotEqual(digest, code_digest(**{**base, "user_id": 35}))
        self.assertNotEqual(digest, code_digest(**{**base, "target_email": "otro@example.com"}))
        self.assertNotEqual(digest, code_digest(**{**base, "code": "012346"}))

    def test_console_backend_refuses_sensitive_codes_without_logging_them(self):
        code = "654321"
        with patch.object(settings, "EMAIL_BACKEND", "console"):
            with self.assertNoLogs("email", level="INFO"):
                with self.assertRaises(email_module.EmailDeliveryError):
                    email_module.send_backup_email_code("private@example.com", code, expires_minutes=10)

    def test_real_transport_message_contains_code_but_logs_do_not(self):
        code = "012398"
        captured_messages = []
        with (
            patch.object(settings, "EMAIL_BACKEND", "smtp"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_FROM", "security@example.test"),
            patch.object(email_module, "_deliver_smtp", side_effect=lambda message: captured_messages.append(message)),
        ):
            with self.assertLogs("email", level="INFO") as captured:
                email_module.send_backup_email_code("private@example.com", code, expires_minutes=10)
        self.assertEqual(len(captured_messages), 1)
        body = captured_messages[0].get_body(preferencelist=("plain",)).get_content()
        self.assertIn(code, body)
        logs = "\n".join(captured.output)
        self.assertNotIn(code, logs)
        self.assertNotIn("private@example.com", logs)

    def test_smtp_failure_does_not_log_recipient_or_verification_code(self):
        code = "987654"
        with (
            patch.object(settings, "EMAIL_BACKEND", "smtp"),
            patch.object(settings, "SMTP_HOST", "smtp.example.test"),
            patch.object(settings, "SMTP_FROM", "security@example.test"),
            patch.object(email_module, "_deliver_smtp", side_effect=OSError("transport failed")),
        ):
            with self.assertLogs("email", level="WARNING") as captured:
                with self.assertRaises(email_module.EmailDeliveryError):
                    email_module.send_backup_email_code("private@example.com", code, expires_minutes=10)
        logs = "\n".join(captured.output)
        self.assertNotIn(code, logs)
        self.assertNotIn("private@example.com", logs)

    def test_security_notice_does_not_log_recipient_when_console_is_enabled(self):
        with patch.object(settings, "EMAIL_BACKEND", "console"), patch.object(settings, "SMTP_HOST", None):
            with self.assertLogs("email", level="INFO") as captured:
                email_module.send_backup_email_notice("private@example.com", action="verified")
        self.assertNotIn("private@example.com", "\n".join(captured.output))


if __name__ == "__main__":
    unittest.main()
