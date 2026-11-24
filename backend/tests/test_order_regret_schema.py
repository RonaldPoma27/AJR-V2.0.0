import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from app.schemas.order_regret import OrderRegretReceipt, OrderRegretRequest


class OrderRegretSchemaTests(unittest.TestCase):
    def test_valid_public_request(self):
        payload = OrderRegretRequest(order_id=1042, contact_email="contacto@empresa.com")
        self.assertEqual(payload.order_id, 1042)
        self.assertEqual(str(payload.contact_email), "contacto@empresa.com")

    def test_order_id_must_be_positive(self):
        with self.assertRaises(ValidationError):
            OrderRegretRequest(order_id=0, contact_email="contacto@empresa.com")

    def test_unknown_fields_are_rejected(self):
        with self.assertRaises(ValidationError):
            OrderRegretRequest(
                order_id=1042,
                contact_email="contacto@empresa.com",
                force_approve=True,
            )

    def test_receipt_contains_tracking_reference(self):
        receipt = OrderRegretReceipt(
            request_code="AJR-AR-A1B2C3D4E5F6",
            requested_at=datetime(2026, 11, 12, tzinfo=timezone.utc),
        )
        self.assertTrue(receipt.request_code.startswith("AJR-AR-"))
        self.assertIn("código", receipt.message)


if __name__ == "__main__":
    unittest.main()
