"""Run from backend with --apply, without advancing Alembic past deployed code.

After committing 0008_repair_schema.py to the deployment repository, normal
alembic upgrade head records revision 0008; its repair is already satisfied.
"""
import argparse
import asyncio
import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.core.database import engine
from app.models import Base


def run(conn, apply):
    revisions = list(conn.scalars(sa.text("SELECT version_num FROM public.alembic_version")))
    if revisions != ["0007_agile_projects"]:
        raise RuntimeError("Expected revision 0007_agile_projects; stop and review the database state.")
    print("Revision registrada: 0007_agile_projects", flush=True)
    inspector = sa.inspect(conn)
    targets = [t for t in Base.metadata.sorted_tables
               if t.name.startswith(("backup_email", "agile_"))]
    for table in targets:
        if not inspector.has_table(table.name, schema="public"):
            print("FALTA TABLA:", table.name, flush=True)
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name, schema="public")}
        missing = sorted(set(table.columns.keys()) - existing)
        if missing:
            print("FALTAN COLUMNAS:", table.name, ", ".join(missing), flush=True)

    if not apply:
        print("Solo diagnostico. Para reparar: python repair_schema_once.py --apply", flush=True)
        return

    path = Path(__file__).resolve().parent / "alembic" / "versions" / "0008_repair_schema.py"
    spec = importlib.util.spec_from_file_location("ajr_repair_0008", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    context = MigrationContext.configure(conn, opts={"target_metadata": Base.metadata})
    with Operations.context(context):
        migration.upgrade()

    # Validate all affected ORM projections inside the transaction; a failure
    # rolls back the complete repair, including the archive move.
    for table in targets:
        conn.execute(sa.select(table).limit(0))
    inspector = sa.inspect(conn)
    if inspector.get_pk_constraint("backup_email_challenges", schema="public")["constrained_columns"] != ["user_id"]:
        raise RuntimeError("Unexpected challenge primary key after repair.")
    for column in inspector.get_columns("backup_email_challenges", schema="public"):
        if column["name"] in {"expires_at", "sent_at"} and not column["type"].timezone:
            raise RuntimeError("Challenge timestamps must be timezone-aware.")


async def main(apply):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(run, apply)
        if apply:
            print("REPARACION CONFIRMADA. Alembic permanece en 0007_agile_projects.", flush=True)
            print("Los codigos antiguos quedan archivados; solicita un codigo nuevo.", flush=True)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply the repair transaction to the configured database")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
