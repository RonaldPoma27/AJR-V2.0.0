"""dominio de la v1 (pedidos, partners, portfolio extendido) + postulaciones

Revision ID: 0002_v1_domain_and_forms
Revises: 0001
Create Date: 2026-09-29

- users.full_name
- client_orders, partners (vienen de la v1)
- portfolio_items: status, client_name, project_url (la v1 los tenía en `projects`)
- job_applications (Trabajá con nosotros)
- prompt_templates (portada de la v1, sin API)
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_v1_domain_and_forms"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: los tipos ENUM se crean una sola vez, explícitamente, en upgrade().
order_status = postgresql.ENUM(
    "nuevo", "en_revision", "contactado", "descartado", name="order_status", create_type=False
)
project_status = postgresql.ENUM(
    "terminado", "en_progreso", name="project_status", create_type=False
)
application_status = postgresql.ENUM(
    "nueva",
    "en_revision",
    "entrevista",
    "descartada",
    "contratada",
    name="application_status",
    create_type=False,
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
    order_status.create(bind, checkfirst=True)
    project_status.create(bind, checkfirst=True)
    application_status.create(bind, checkfirst=True)

    # ------------------------------------------------------------------ users
    op.add_column("users", sa.Column("full_name", sa.String(length=150), nullable=True))

    # ---------------------------------------------------------- portfolio_items
    op.add_column(
        "portfolio_items",
        sa.Column("status", project_status, server_default="en_progreso", nullable=False),
    )
    op.add_column("portfolio_items", sa.Column("client_name", sa.String(length=200), nullable=True))
    op.add_column("portfolio_items", sa.Column("project_url", sa.String(length=500), nullable=True))

    # ------------------------------------------------------------ client_orders
    op.create_table(
        "client_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("contact_name", sa.String(length=200), nullable=False),
        sa.Column("contact_email", sa.String(length=320), nullable=False),
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
        sa.Column("industry", sa.String(length=120), nullable=False),
        sa.Column("problem_description", sa.Text(), nullable=False),
        sa.Column("status", order_status, server_default="nuevo", nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_orders")),
    )
    op.create_index(op.f("ix_client_orders_status"), "client_orders", ["status"])

    # ---------------------------------------------------------------- partners
    op.create_table(
        "partners",
        sa.Column("id", sa.Integer(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("industry", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_partners")),
    )

    # ----------------------------------------------------------- job_applications
    op.create_table(
        "job_applications",
        sa.Column("id", sa.Integer(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("location", sa.String(length=150), nullable=False),
        sa.Column("area", sa.String(length=60), nullable=False),
        sa.Column("experience_level", sa.String(length=30), nullable=True),
        sa.Column("linkedin_url", sa.String(length=500), nullable=True),
        sa.Column("github_url", sa.String(length=500), nullable=True),
        sa.Column("cv_url", sa.String(length=500), nullable=True),
        sa.Column("motivation", sa.Text(), nullable=False),
        sa.Column("availability", sa.String(length=30), nullable=True),
        sa.Column("consent", sa.Boolean(), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", application_status, server_default="nueva", nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_job_applications")),
    )
    op.create_index(op.f("ix_job_applications_status"), "job_applications", ["status"])

    # -------------------------------------------------------- prompt_templates
    op.create_table(
        "prompt_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("tags", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name=op.f("fk_prompt_templates_author_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prompt_templates")),
    )
    op.create_index(op.f("ix_prompt_templates_category"), "prompt_templates", ["category"])


def downgrade() -> None:
    op.drop_table("prompt_templates")
    op.drop_table("job_applications")
    op.drop_table("partners")
    op.drop_table("client_orders")
    op.drop_column("portfolio_items", "project_url")
    op.drop_column("portfolio_items", "client_name")
    op.drop_column("portfolio_items", "status")
    op.drop_column("users", "full_name")

    bind = op.get_bind()
    application_status.drop(bind, checkfirst=True)
    project_status.drop(bind, checkfirst=True)
    order_status.drop(bind, checkfirst=True)
