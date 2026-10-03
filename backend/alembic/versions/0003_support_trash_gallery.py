"""nombre/apellido, pedidos ligados a usuario, papelera, galería de portfolio y chat de soporte

Revision ID: 0003_support_trash_gallery
Revises: 0002_v1_domain_and_forms
Create Date: 2026-10-01

- users: first_name / last_name (reemplazan a full_name, que ahora es una propiedad del modelo).
  Los datos existentes se migran: la primera palabra va a first_name y el resto a last_name.
- order_status: nuevo valor `finalizado`.
- client_orders: user_id (FK a users) + deleted_at. Los pedidos viejos quedan con user_id NULL.
- job_applications: deleted_at.
- portfolio_media (galería). Las `image_url` existentes se copian como primer archivo de la
  galería y la columna portfolio_items.image_url se elimina.
- support_tickets / support_messages (chat de soporte).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_support_trash_gallery"
down_revision: str | None = "0002_v1_domain_and_forms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

media_type = postgresql.ENUM("image", "video", "file", name="media_type", create_type=False)
support_ticket_status = postgresql.ENUM(
    "abierto", "respondido", "cerrado", name="support_ticket_status", create_type=False
)


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def _updated_at() -> sa.Column:
    return sa.Column(
        "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    bind = op.get_bind()
    media_type.create(bind, checkfirst=True)
    support_ticket_status.create(bind, checkfirst=True)

    # ------------------------------------------------------------------ users
    op.add_column("users", sa.Column("first_name", sa.String(length=75), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=75), nullable=True))
    # "Ana María Pérez" -> first_name "Ana", last_name "María Pérez".
    op.execute(
        """
        UPDATE users
        SET first_name = NULLIF(split_part(btrim(full_name), ' ', 1), ''),
            last_name  = NULLIF(btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1)), '')
        WHERE full_name IS NOT NULL
        """
    )
    op.drop_column("users", "full_name")

    # ------------------------------------------------------------ order_status
    # PostgreSQL >= 12 permite ADD VALUE dentro de una transacción (el valor nuevo solo no se
    # puede *usar* hasta el commit, y esta migración no lo usa).
    op.execute("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'finalizado' AFTER 'contactado'")

    # ------------------------------------------------------------ client_orders
    op.add_column("client_orders", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column(
        "client_orders", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        op.f("fk_client_orders_user_id_users"),
        "client_orders",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_client_orders_user_id"), "client_orders", ["user_id"])
    op.create_index(op.f("ix_client_orders_deleted_at"), "client_orders", ["deleted_at"])

    # -------------------------------------------------------- job_applications
    op.add_column(
        "job_applications", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(op.f("ix_job_applications_deleted_at"), "job_applications", ["deleted_at"])

    # --------------------------------------------------------- portfolio_media
    op.create_table(
        "portfolio_media",
        sa.Column("id", sa.Integer(), nullable=False),
        _created_at(),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("media_type", media_type, server_default="image", nullable=False),
        sa.Column("caption", sa.String(length=300), nullable=True),
        sa.Column("public_id", sa.String(length=300), nullable=True),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["portfolio_items.id"],
            name=op.f("fk_portfolio_media_item_id_portfolio_items"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portfolio_media")),
    )
    op.create_index(op.f("ix_portfolio_media_item_id"), "portfolio_media", ["item_id"])
    # La imagen única de antes pasa a ser el primer archivo de la galería.
    op.execute(
        """
        INSERT INTO portfolio_media (item_id, url, media_type, position)
        SELECT id, image_url, 'image', 0 FROM portfolio_items WHERE image_url IS NOT NULL
        """
    )
    op.drop_column("portfolio_items", "image_url")

    # ---------------------------------------------------------- support_tickets
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("status", support_ticket_status, server_default="abierto", nullable=False),
        sa.Column(
            "last_message_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_support_tickets_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_tickets")),
    )
    op.create_index(op.f("ix_support_tickets_user_id"), "support_tickets", ["user_id"])
    op.create_index(op.f("ix_support_tickets_status"), "support_tickets", ["status"])

    op.create_table(
        "support_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        _created_at(),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "char_length(content) <= 2000 AND char_length(btrim(content)) > 0",
            name=op.f("ck_support_messages_content_length"),
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["support_tickets.id"],
            name=op.f("fk_support_messages_ticket_id_support_tickets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"], ["users.id"], name=op.f("fk_support_messages_sender_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_messages")),
    )
    op.create_index(op.f("ix_support_messages_ticket_id"), "support_messages", ["ticket_id"])


def downgrade() -> None:
    op.drop_table("support_messages")
    op.drop_table("support_tickets")

    # Galería -> imagen única (se conserva la primera imagen de cada proyecto).
    op.add_column("portfolio_items", sa.Column("image_url", sa.String(length=500), nullable=True))
    op.execute(
        """
        UPDATE portfolio_items AS p
        SET image_url = m.url
        FROM (
            SELECT DISTINCT ON (item_id) item_id, url
            FROM portfolio_media
            WHERE media_type = 'image' AND char_length(url) <= 500
            ORDER BY item_id, position, id
        ) AS m
        WHERE m.item_id = p.id
        """
    )
    op.drop_table("portfolio_media")

    op.drop_index(op.f("ix_job_applications_deleted_at"), table_name="job_applications")
    op.drop_column("job_applications", "deleted_at")

    op.drop_index(op.f("ix_client_orders_deleted_at"), table_name="client_orders")
    op.drop_index(op.f("ix_client_orders_user_id"), table_name="client_orders")
    op.drop_constraint(op.f("fk_client_orders_user_id_users"), "client_orders", type_="foreignkey")
    op.drop_column("client_orders", "deleted_at")
    op.drop_column("client_orders", "user_id")

    # PostgreSQL no permite quitar un valor de un ENUM: 'finalizado' queda en el tipo (inocuo)
    # y los pedidos que lo usaban vuelven a 'contactado'.
    op.execute("UPDATE client_orders SET status = 'contactado' WHERE status = 'finalizado'")

    op.add_column("users", sa.Column("full_name", sa.String(length=150), nullable=True))
    op.execute(
        """
        UPDATE users
        SET full_name = NULLIF(btrim(concat_ws(' ', first_name, last_name)), '')
        """
    )
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")

    bind = op.get_bind()
    support_ticket_status.drop(bind, checkfirst=True)
    media_type.drop(bind, checkfirst=True)
