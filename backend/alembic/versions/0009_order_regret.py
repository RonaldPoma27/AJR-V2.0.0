"""Track public order-regret requests.

Revision ID: 0009_order_regret
Revises: 0008_repair_schema
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_order_regret"
down_revision = "0008_repair_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("client_orders", sa.Column("regret_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("client_orders", sa.Column("regret_code", sa.String(length=40), nullable=True))
    op.create_index("ix_client_orders_regret_code", "client_orders", ["regret_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_client_orders_regret_code", table_name="client_orders")
    op.drop_column("client_orders", "regret_code")
    op.drop_column("client_orders", "regret_requested_at")
