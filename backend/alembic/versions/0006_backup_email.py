"""Verified backup email and persistent abuse limits (ajrdata-v3.2-rea)."""
from alembic import op
import sqlalchemy as sa

revision = "0006_backup_email"
down_revision = "0005_order_plan_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("backup_emails",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("backup_email_challenges",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("purpose", sa.String(30), nullable=False),
        sa.Column("nonce", sa.String(32), nullable=False),
        sa.Column("code_digest", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.CheckConstraint("attempts >= 0", name="nonnegative_attempts"))
    op.create_index("ix_backup_email_challenges_expires_at", "backup_email_challenges", ["expires_at"])
    op.create_table("backup_email_rate_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_backup_rate_key_time", "backup_email_rate_events", ["key", "created_at"])
    op.create_index("ix_backup_email_rate_events_created_at", "backup_email_rate_events", ["created_at"])


def downgrade():
    op.drop_table("backup_email_rate_events")
    op.drop_table("backup_email_challenges")
    op.drop_table("backup_emails")
