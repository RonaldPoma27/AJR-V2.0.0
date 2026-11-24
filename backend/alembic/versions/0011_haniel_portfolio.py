"""Add Haniel configurable Bento portfolio blocks, palette, logo and priority.

Revision ID: 0011_haniel_portfolio
Revises: 0010_email_outbox
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_haniel_portfolio"
down_revision = "0010_email_outbox"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("portfolio_items", sa.Column("logo_url", sa.String(length=1000), nullable=True))
    op.add_column("portfolio_items", sa.Column("position", sa.Integer(), server_default="0", nullable=False))
    op.add_column("portfolio_items", sa.Column("style", sa.JSON(), server_default=sa.text("'{}'"), nullable=False))
    op.add_column("portfolio_items", sa.Column("blocks", sa.JSON(), server_default=sa.text("'[]'"), nullable=False))

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM portfolio_items ORDER BY created_at DESC, id DESC")).fetchall()
    for position, row in enumerate(rows):
        bind.execute(
            sa.text("UPDATE portfolio_items SET position = :position WHERE id = :item_id"),
            {"position": position, "item_id": row[0]},
        )
    op.create_index("ix_portfolio_items_position", "portfolio_items", ["position"])


def downgrade() -> None:
    op.drop_index("ix_portfolio_items_position", table_name="portfolio_items")
    op.drop_column("portfolio_items", "blocks")
    op.drop_column("portfolio_items", "style")
    op.drop_column("portfolio_items", "position")
    op.drop_column("portfolio_items", "logo_url")
