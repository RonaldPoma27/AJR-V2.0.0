"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-27

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: los tipos ENUM se crean una sola vez, explícitamente, en upgrade().
# (ticket_status se reutiliza en tres columnas.)
user_role = postgresql.ENUM("USER", "TECHNICIAN", "ADMIN", name="user_role", create_type=False)
ticket_status = postgresql.ENUM(
    "PENDING",
    "DIAGNOSING",
    "WAITING_APPROVAL",
    "APPROVED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    name="ticket_status",
    create_type=False,
)


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    ticket_status.create(bind, checkfirst=True)

    # ------------------------------------------------------------------ users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, server_default="USER", nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # -------------------------------------------------------------------- CMS
    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        _created_at(),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_services")),
    )
    op.create_table(
        "portfolio_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        _created_at(),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portfolio_items")),
    )
    op.create_table(
        "blog_posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        _created_at(),
        sa.Column("content", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_blog_posts")),
    )

    # ---------------------------------------------------------------- tickets
    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", ticket_status, server_default="PENDING", nullable=False),
        sa.Column("estimated_cost", sa.Float(), nullable=True),
        _created_at(),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_tickets_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tickets")),
    )
    op.create_index(op.f("ix_tickets_user_id"), "tickets", ["user_id"])
    op.create_index(op.f("ix_tickets_status"), "tickets", ["status"])

    op.create_table(
        "ticket_updates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("previous_status", ticket_status, nullable=True),
        sa.Column("new_status", ticket_status, nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name=op.f("fk_ticket_updates_ticket_id_tickets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name=op.f("fk_ticket_updates_author_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ticket_updates")),
    )
    op.create_index(op.f("ix_ticket_updates_ticket_id"), "ticket_updates", ["ticket_id"])

    op.create_table(
        "ticket_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name=op.f("fk_ticket_comments_ticket_id_tickets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name=op.f("fk_ticket_comments_author_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ticket_comments")),
    )
    op.create_index(op.f("ix_ticket_comments_ticket_id"), "ticket_comments", ["ticket_id"])


def downgrade() -> None:
    op.drop_table("ticket_comments")
    op.drop_table("ticket_updates")
    op.drop_table("tickets")
    op.drop_table("blog_posts")
    op.drop_table("portfolio_items")
    op.drop_table("services")
    op.drop_table("users")

    bind = op.get_bind()
    ticket_status.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
