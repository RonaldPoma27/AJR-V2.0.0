"""Agregar correo de respaldo y desafíos de verificación.

Revision ID: 0006_backup_email
Revises: 0005_order_plan_fields
Create Date: 2026-10-29
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_backup_email"
down_revision: str | None = "0005_order_plan_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "backup_emails",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="PENDING", nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('PENDING', 'VERIFIED')", name=op.f("ck_backup_emails_valid_status")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_backup_emails_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_backup_emails")),
    )
    op.create_index("ix_backup_emails_email", "backup_emails", ["email"], unique=False)
    op.create_index("ix_backup_emails_user_id", "backup_emails", ["user_id"], unique=False)
    op.create_index("ix_backup_emails_user_status", "backup_emails", ["user_id", "status"], unique=False)
    op.create_index(
        "uq_backup_emails_verified_email",
        "backup_emails",
        ["email"],
        unique=True,
        postgresql_where=sa.text("status = 'VERIFIED'"),
    )
    op.create_index(
        "uq_backup_emails_one_pending_per_user",
        "backup_emails",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )
    op.create_index(
        "uq_backup_emails_one_verified_per_user",
        "backup_emails",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'VERIFIED'"),
    )

    op.create_table(
        "backup_email_challenges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("target_email", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.String(length=32), server_default="VERIFY_BACKUP_EMAIL", nullable=False),
        sa.Column("code_hmac", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("request_ip", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("attempts >= 0", name=op.f("ck_backup_email_challenges_nonnegative_attempts")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_backup_email_challenges_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_backup_email_challenges")),
    )
    op.create_index("ix_backup_email_challenges_user_id", "backup_email_challenges", ["user_id"], unique=False)
    op.create_index("ix_backup_email_challenges_expires_at", "backup_email_challenges", ["expires_at"], unique=False)
    op.create_index("ix_backup_email_challenges_user_created", "backup_email_challenges", ["user_id", "created_at"], unique=False)
    op.create_index("ix_backup_email_challenges_target_created", "backup_email_challenges", ["target_email", "created_at"], unique=False)
    op.create_index("ix_backup_email_challenges_ip_created", "backup_email_challenges", ["request_ip", "created_at"], unique=False)
    op.create_index(
        "ix_backup_email_challenges_user_active",
        "backup_email_challenges",
        ["user_id", "purpose", "consumed_at", "invalidated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_backup_email_challenges_user_active", table_name="backup_email_challenges")
    op.drop_index("ix_backup_email_challenges_ip_created", table_name="backup_email_challenges")
    op.drop_index("ix_backup_email_challenges_target_created", table_name="backup_email_challenges")
    op.drop_index("ix_backup_email_challenges_user_created", table_name="backup_email_challenges")
    op.drop_index("ix_backup_email_challenges_expires_at", table_name="backup_email_challenges")
    op.drop_index("ix_backup_email_challenges_user_id", table_name="backup_email_challenges")
    op.drop_table("backup_email_challenges")
    op.drop_index("uq_backup_emails_verified_email", table_name="backup_emails")
    op.drop_index("uq_backup_emails_one_verified_per_user", table_name="backup_emails")
    op.drop_index("uq_backup_emails_one_pending_per_user", table_name="backup_emails")
    op.drop_index("ix_backup_emails_user_status", table_name="backup_emails")
    op.drop_index("ix_backup_emails_user_id", table_name="backup_emails")
    op.drop_index("ix_backup_emails_email", table_name="backup_emails")
    op.drop_table("backup_emails")
