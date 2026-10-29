"""Agregar módulo de proyectos ágiles Scrumban.

Revision ID: 0007_agile_projects
Revises: 0006_backup_email
Create Date: 2026-10-29
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_agile_projects"
down_revision: str | None = "0006_backup_email"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "agile_projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=140), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="ACTIVE", nullable=False),
        sa.Column("sprint_length_weeks", sa.Integer(), server_default="2", nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("sprint_length_weeks BETWEEN 1 AND 4", name=op.f("ck_agile_projects_valid_sprint_length")),
        sa.CheckConstraint("status IN ('ACTIVE', 'ARCHIVED')", name=op.f("ck_agile_projects_valid_status")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT", name="fk_agile_projects_owner_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_agile_projects"),
        sa.UniqueConstraint("key", name="uq_agile_projects_key"),
    )
    op.create_table(
        "agile_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('SCRUM_MASTER', 'PRODUCT_OWNER', 'DEVELOPER', 'OBSERVER')", name=op.f("ck_agile_memberships_valid_role")),
        sa.ForeignKeyConstraint(["project_id"], ["agile_projects.id"], ondelete="CASCADE", name="fk_agile_memberships_project_id_agile_projects"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="fk_agile_memberships_user_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_agile_memberships"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_agile_memberships_project_user"),
    )
    op.create_index("ix_agile_memberships_project_id", "agile_memberships", ["project_id"])
    op.create_index("ix_agile_memberships_user_id", "agile_memberships", ["user_id"])

    op.create_table(
        "agile_sprints",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("goal", sa.Text(), server_default="", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="PLANNED", nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('PLANNED', 'ACTIVE', 'COMPLETED')", name=op.f("ck_agile_sprints_valid_status")),
        sa.CheckConstraint("end_date >= start_date", name=op.f("ck_agile_sprints_valid_date_range")),
        sa.ForeignKeyConstraint(["project_id"], ["agile_projects.id"], ondelete="CASCADE", name="fk_agile_sprints_project_id_agile_projects"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT", name="fk_agile_sprints_created_by_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_agile_sprints"),
    )
    op.create_index("ix_agile_sprints_project_id", "agile_sprints", ["project_id"])
    op.create_index("ix_agile_sprints_project_dates", "agile_sprints", ["project_id", "start_date", "end_date"])
    op.create_index("uq_agile_sprints_one_active_per_project", "agile_sprints", ["project_id"], unique=True, postgresql_where=sa.text("status = 'ACTIVE'"))

    op.create_table(
        "agile_work_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=24), server_default="PENDING", nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("acceptance_criteria", sa.Text(), server_default="", nullable=False),
        sa.Column("item_type", sa.String(length=16), server_default="STORY", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="TODO", nullable=False),
        sa.Column("priority", sa.String(length=16), server_default="MEDIUM", nullable=False),
        sa.Column("assigned_role", sa.String(length=20), nullable=True),
        sa.Column("estimate_points", sa.Integer(), nullable=True),
        sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("project_epic_id", sa.Integer(), nullable=True),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("sprint_id", sa.Integer(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("item_type IN ('EPIC', 'STORY', 'TASK', 'BUG', 'SUBTASK')", name=op.f("ck_agile_work_items_valid_item_type")),
        sa.CheckConstraint("status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED')", name=op.f("ck_agile_work_items_valid_status")),
        sa.CheckConstraint("priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')", name=op.f("ck_agile_work_items_valid_priority")),
        sa.CheckConstraint("assigned_role IS NULL OR assigned_role IN ('SCRUM_MASTER', 'PRODUCT_OWNER', 'DEVELOPER')", name=op.f("ck_agile_work_items_valid_assigned_role")),
        sa.CheckConstraint("estimate_points IS NULL OR estimate_points >= 0", name=op.f("ck_agile_work_items_nonnegative_estimate")),
        sa.ForeignKeyConstraint(["project_id"], ["agile_projects.id"], ondelete="CASCADE", name="fk_agile_work_items_project_id_agile_projects"),
        sa.ForeignKeyConstraint(["project_epic_id"], ["agile_work_items.id"], ondelete="SET NULL", name="fk_agile_work_items_project_epic_id_agile_work_items"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="SET NULL", name="fk_agile_work_items_assignee_id_users"),
        sa.ForeignKeyConstraint(["sprint_id"], ["agile_sprints.id"], ondelete="SET NULL", name="fk_agile_work_items_sprint_id_agile_sprints"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT", name="fk_agile_work_items_created_by_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_agile_work_items"),
        sa.UniqueConstraint("project_id", "key", name="uq_agile_work_items_project_key"),
    )
    op.create_index("ix_agile_work_items_project_status", "agile_work_items", ["project_id", "status"])
    op.create_index("ix_agile_work_items_project_sprint", "agile_work_items", ["project_id", "sprint_id"])
    op.create_index("ix_agile_work_items_project_epic", "agile_work_items", ["project_id", "project_epic_id"])
    op.create_index("ix_agile_work_items_project_type", "agile_work_items", ["project_id", "item_type"])

    op.create_table(
        "agile_sprint_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sprint_id", sa.Integer(), nullable=False),
        sa.Column("work_item_id", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(length=24), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["sprint_id"], ["agile_sprints.id"], ondelete="CASCADE", name="fk_agile_sprint_items_sprint_id_agile_sprints"),
        sa.ForeignKeyConstraint(["work_item_id"], ["agile_work_items.id"], ondelete="CASCADE", name="fk_agile_sprint_items_work_item_id_agile_work_items"),
        sa.PrimaryKeyConstraint("id", name="pk_agile_sprint_items"),
        sa.UniqueConstraint("sprint_id", "work_item_id", name="uq_agile_sprint_items_sprint_item"),
    )
    op.create_index("ix_agile_sprint_items_sprint_id", "agile_sprint_items", ["sprint_id"])
    op.create_index("ix_agile_sprint_items_work_item_id", "agile_sprint_items", ["work_item_id"])

    op.create_table(
        "agile_work_item_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("work_item_id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=40), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["agile_projects.id"], ondelete="CASCADE", name="fk_agile_work_item_history_project_id_agile_projects"),
        sa.ForeignKeyConstraint(["work_item_id"], ["agile_work_items.id"], ondelete="CASCADE", name="fk_agile_work_item_history_work_item_id_agile_work_items"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT", name="fk_agile_work_item_history_actor_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_agile_work_item_history"),
    )
    op.create_index("ix_agile_work_item_history_project_id", "agile_work_item_history", ["project_id"])
    op.create_index("ix_agile_work_item_history_work_item_id", "agile_work_item_history", ["work_item_id"])


    op.create_table(
        "agile_work_item_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("work_item_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["agile_projects.id"], ondelete="CASCADE", name="fk_agile_work_item_comments_project_id_agile_projects"),
        sa.ForeignKeyConstraint(["work_item_id"], ["agile_work_items.id"], ondelete="CASCADE", name="fk_agile_work_item_comments_work_item_id_agile_work_items"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT", name="fk_agile_work_item_comments_author_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_agile_work_item_comments"),
    )
    op.create_index("ix_agile_work_item_comments_project_id", "agile_work_item_comments", ["project_id"])
    op.create_index("ix_agile_work_item_comments_work_item_id", "agile_work_item_comments", ["work_item_id"])


def downgrade() -> None:
    op.drop_index("ix_agile_work_item_comments_work_item_id", table_name="agile_work_item_comments")
    op.drop_index("ix_agile_work_item_comments_project_id", table_name="agile_work_item_comments")
    op.drop_table("agile_work_item_comments")
    op.drop_index("ix_agile_work_item_history_work_item_id", table_name="agile_work_item_history")
    op.drop_index("ix_agile_work_item_history_project_id", table_name="agile_work_item_history")
    op.drop_table("agile_work_item_history")
    op.drop_index("ix_agile_sprint_items_work_item_id", table_name="agile_sprint_items")
    op.drop_index("ix_agile_sprint_items_sprint_id", table_name="agile_sprint_items")
    op.drop_table("agile_sprint_items")
    op.drop_index("ix_agile_work_items_project_type", table_name="agile_work_items")
    op.drop_index("ix_agile_work_items_project_epic", table_name="agile_work_items")
    op.drop_index("ix_agile_work_items_project_sprint", table_name="agile_work_items")
    op.drop_index("ix_agile_work_items_project_status", table_name="agile_work_items")
    op.drop_table("agile_work_items")
    op.drop_index("uq_agile_sprints_one_active_per_project", table_name="agile_sprints")
    op.drop_index("ix_agile_sprints_project_dates", table_name="agile_sprints")
    op.drop_index("ix_agile_sprints_project_id", table_name="agile_sprints")
    op.drop_table("agile_sprints")
    op.drop_index("ix_agile_memberships_user_id", table_name="agile_memberships")
    op.drop_index("ix_agile_memberships_project_id", table_name="agile_memberships")
    op.drop_table("agile_memberships")
    op.drop_table("agile_projects")
