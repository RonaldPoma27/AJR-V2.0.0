"""plan, presupuesto, plazo y dominio en los pedidos

Revision ID: 0005_order_plan_fields
Revises: 0004_audit_and_ip_blocks
Create Date: 2026-10-26
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_order_plan_fields"
down_revision: str | None = "0004_audit_and_ip_blocks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Todas nullable: los pedidos existentes quedan sin esos datos.
    op.add_column("client_orders", sa.Column("plan", sa.String(length=30), nullable=True))
    op.add_column("client_orders", sa.Column("budget", sa.String(length=20), nullable=True))
    op.add_column("client_orders", sa.Column("timeline", sa.String(length=20), nullable=True))
    op.add_column("client_orders", sa.Column("has_domain", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("client_orders", "has_domain")
    op.drop_column("client_orders", "timeline")
    op.drop_column("client_orders", "budget")
    op.drop_column("client_orders", "plan")
