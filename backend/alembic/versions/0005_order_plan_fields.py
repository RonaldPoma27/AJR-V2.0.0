"""plan, presupuesto, plazo, dominio y paso del proyecto en los pedidos

Revision ID: 0005_order_plan_fields
Revises: 0004_audit_and_ip_blocks
Create Date: 2026-10-26

- client_orders: plan, budget, timeline, has_domain (NULL en los pedidos anteriores) y
  project_step (1..5, default 1) que ve el cliente en su línea de progreso.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_order_plan_fields"
down_revision: str | None = "0004_audit_and_ip_blocks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("client_orders", sa.Column("plan", sa.String(length=30), nullable=True))
    op.add_column("client_orders", sa.Column("budget", sa.String(length=20), nullable=True))
    op.add_column("client_orders", sa.Column("timeline", sa.String(length=20), nullable=True))
    op.add_column("client_orders", sa.Column("has_domain", sa.Boolean(), nullable=True))
    op.add_column(
        "client_orders",
        sa.Column("project_step", sa.SmallInteger(), server_default=sa.text("1"), nullable=False),
    )
    op.create_check_constraint(
        "project_step_range", "client_orders", "project_step BETWEEN 1 AND 5"
    )
    op.create_index("ix_client_orders_plan", "client_orders", ["plan"])


def downgrade() -> None:
    op.drop_index("ix_client_orders_plan", table_name="client_orders")
    op.drop_constraint("project_step_range", "client_orders", type_="check")
    for col in ("project_step", "has_domain", "timeline", "budget", "plan"):
        op.drop_column("client_orders", col)
