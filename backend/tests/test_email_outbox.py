import unittest

from app.core.outbox_policy import retry_delay


class EmailOutboxRetryTests(unittest.TestCase):
    def test_retry_delay_grows_exponentially(self):
        self.assertEqual(retry_delay(1).total_seconds(), 120)
        self.assertEqual(retry_delay(2).total_seconds(), 240)

    def test_retry_delay_is_capped_at_one_hour(self):
        self.assertEqual(retry_delay(6).total_seconds(), 3600)
        self.assertEqual(retry_delay(20).total_seconds(), 3600)

    def test_non_positive_attempt_uses_first_retry_delay(self):
        self.assertEqual(retry_delay(0).total_seconds(), 120)


if __name__ == "__main__":
    unittest.main()
