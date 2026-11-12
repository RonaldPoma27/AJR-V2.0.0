"""Add durable transactional email outbox.

Revision ID: 0010_email_outbox
Revises: 0009_order_regret
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_email_outbox"
down_revision = "0009_order_regret"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_outbox",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dedupe_key", sa.String(length=120), nullable=False, unique=True),
        sa.Column("event_type", sa.String(length=60), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("client_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recipient", sa.String(length=320), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="PENDING", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_alerted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_email_outbox_status_next_attempt", "email_outbox", ["status", "next_attempt_at"])
    op.create_index("ix_email_outbox_event_type", "email_outbox", ["event_type"])
    op.create_index("ix_email_outbox_order_id", "email_outbox", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_email_outbox_order_id", table_name="email_outbox")
    op.drop_index("ix_email_outbox_event_type", table_name="email_outbox")
    op.drop_index("ix_email_outbox_status_next_attempt", table_name="email_outbox")
    op.drop_table("email_outbox")
