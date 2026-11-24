import unittest
from datetime import date, timedelta

from pydantic import ValidationError

from app.schemas.agile import ProjectCreate, SprintCreate, WorkItemCreate, WorkItemReorder


class AgileSchemaTests(unittest.TestCase):
    def test_project_key_is_normalized_to_uppercase(self):
        project = ProjectCreate(key="ajr1", name="Proyecto ágil")
        self.assertEqual(project.key, "AJR1")

    def test_sprint_lengths_from_one_to_four_weeks_are_accepted(self):
        start = date(2026, 10, 29)
        for weeks in range(1, 5):
            with self.subTest(weeks=weeks):
                sprint = SprintCreate(
                    name=f"Sprint {weeks}",
                    start_date=start,
                    end_date=start + timedelta(days=weeks * 7 - 1),
                )
                self.assertEqual((sprint.end_date - sprint.start_date).days + 1, weeks * 7)

    def test_sprint_longer_than_four_weeks_is_rejected(self):
        start = date(2026, 10, 29)
        with self.assertRaises(ValidationError):
            SprintCreate(name="Sprint largo", start_date=start, end_date=start + timedelta(days=28))

    def test_sprint_shorter_than_one_week_is_rejected(self):
        start = date(2026, 10, 29)
        with self.assertRaises(ValidationError):
            SprintCreate(name="Sprint corto", start_date=start, end_date=start + timedelta(days=5))

    def test_observer_cannot_be_selected_as_card_responsible_role(self):
        with self.assertRaises(ValidationError):
            WorkItemCreate(title="HU de prueba", assigned_role="OBSERVER")

    def test_backlog_reorder_rejects_duplicate_ids(self):
        with self.assertRaises(ValidationError):
            WorkItemReorder(item_ids=[12, 15, 12])


if __name__ == "__main__":
    unittest.main()
