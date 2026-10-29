"""registro de auditoría y bloqueos de IP

Revision ID: 0004_audit_and_ip_blocks
Revises: 0003_support_trash_gallery
Create Date: 2026-10-05
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_audit_and_ip_blocks"
down_revision: str | None = "0003_support_trash_gallery"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_email", sa.String(length=255), nullable=True),
        sa.Column("user_role", sa.String(length=20), nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("entity", sa.String(length=60), nullable=True),
        sa.Column("entity_id", sa.String(length=40), nullable=True),
        sa.Column("entity_label", sa.String(length=255), nullable=True),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("method", sa.String(length=10), nullable=True),
        sa.Column("path", sa.String(length=300), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_audit_logs_user_id_users", ondelete="SET NULL"
        ),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_user_email", "audit_logs", ["user_email"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity"])
    op.create_index("ix_audit_logs_created_at_id", "audit_logs", ["created_at", "id"])

    op.create_table(
        "ip_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ip", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("blocked_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
    )
    op.create_index("ix_ip_blocks_ip", "ip_blocks", ["ip"])
    op.create_index("ix_ip_blocks_blocked_until", "ip_blocks", ["blocked_until"])


def downgrade() -> None:
    op.drop_table("ip_blocks")
    op.drop_table("audit_logs")
