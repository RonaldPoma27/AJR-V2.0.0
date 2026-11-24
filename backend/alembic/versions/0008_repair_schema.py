"""Repair the observed legacy schema without deleting historical records.

Old challenges are archived, not converted: their HMAC format cannot safely
be interpreted as a nonce-based code_digest. Users must request new codes.
Historical sprint point snapshots remain NULL because they cannot be recovered.
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_repair_schema"
down_revision = "0007_agile_projects"
branch_labels = None
depends_on = None

ARCHIVE = "ajr_legacy_0008"
CHALLENGE = "backup_email_challenges"
CURRENT = {"user_id", "email", "purpose", "nonce", "code_digest",
           "expires_at", "sent_at", "attempts"}
LEGACY = {"id", "user_id", "target_email", "purpose", "code_hmac",
          "expires_at", "attempts", "consumed_at", "invalidated_at",
          "request_ip", "created_at"}


def upgrade():
    conn = op.get_bind()
    if conn.dialect.name != "postgresql":
        raise RuntimeError("0008 requires an online PostgreSQL connection.")
    if conn.scalar(sa.text("SELECT current_schema()")) != "public":
        raise RuntimeError("Expected current_schema() = public; no repair applied.")
    inspector = sa.inspect(conn)
    for name in (CHALLENGE, "backup_emails", "agile_sprint_items"):
        if not inspector.has_table(name, schema="public"):
            raise RuntimeError(f"Unexpected schema: missing public.{name}.")
    columns = {c["name"] for c in inspector.get_columns(CHALLENGE, schema="public")}
    pk = inspector.get_pk_constraint(CHALLENGE, schema="public")["constrained_columns"]
    legacy = columns == LEGACY and pk == ["id"]
    if not legacy and not (columns == CURRENT and pk == ["user_id"]):
        raise RuntimeError("Unrecognized challenge schema; manual review required.")
    if legacy:
        if inspector.has_table(CHALLENGE, schema=ARCHIVE):
            raise RuntimeError("Archive already exists; refusing to overwrite it.")
        references = conn.scalar(sa.text("""
            SELECT count(*) FROM pg_constraint
            WHERE contype = 'f'
              AND confrelid = 'public.backup_email_challenges'::regclass
        """))
        if references:
            raise RuntimeError("Other tables reference legacy challenges; manual review required.")

    rate_exists = inspector.has_table("backup_email_rate_events", schema="public")
    if rate_exists:
        rate_cols = {c["name"] for c in inspector.get_columns("backup_email_rate_events", schema="public")}
        if rate_cols != {"id", "key", "created_at"}:
            raise RuntimeError("Unrecognized rate-event schema; manual review required.")

    # Fail instead of waiting indefinitely for requests holding table locks.
    op.execute("SET LOCAL lock_timeout = '10s'")
    if legacy:
        op.execute(sa.schema.CreateSchema(ARCHIVE, if_not_exists=True))
        # PostgreSQL also moves owned sequences and indexes into this schema.
        # No historical challenge rows are deleted or reused as valid codes.
        op.execute(f'ALTER TABLE public.{CHALLENGE} SET SCHEMA {ARCHIVE}')
        op.create_table(
            CHALLENGE,
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("purpose", sa.String(30), nullable=False),
            sa.Column("nonce", sa.String(32), nullable=False),
            sa.Column("code_digest", sa.String(64), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("user_id", name="pk_backup_email_challenges"),
            sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE",
                                    name="fk_backup_email_challenges_user_id_users"),
            sa.CheckConstraint("attempts >= 0", name=op.f("ck_backup_email_challenges_nonnegative_attempts")),
            schema="public",
        )
        op.create_index("ix_backup_email_challenges_expires_at", CHALLENGE, ["expires_at"], schema="public")

    if not rate_exists:
        op.create_table(
            "backup_email_rate_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("key", sa.String(64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            schema="public",
        )
        op.create_index("ix_backup_rate_key_time", "backup_email_rate_events", ["key", "created_at"], schema="public")
        op.create_index("ix_backup_email_rate_events_created_at", "backup_email_rate_events", ["created_at"], schema="public")

    sprint_cols = {c["name"] for c in inspector.get_columns("agile_sprint_items", schema="public")}
    if "estimate_points_snapshot" not in sprint_cols:
        op.add_column("agile_sprint_items", sa.Column("estimate_points_snapshot", sa.Integer(), nullable=True), schema="public")


def downgrade():
    raise RuntimeError(
        "Automatic downgrade is disabled: restoring the legacy challenge table "
        "could reactivate old challenges or discard new data. Use a reviewed restore plan."
    )
