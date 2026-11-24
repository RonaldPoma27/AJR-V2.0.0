"""Portable SQLite smoke test for the standalone Haniel schema upgrade."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text


MIGRATION = Path(__file__).parents[1] / "alembic" / "versions" / "0011_haniel_portfolio.py"


def test_haniel_migration_adds_columns_and_preserves_existing_priority():
    spec = importlib.util.spec_from_file_location("haniel_migration", MIGRATION)
    migration = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(migration)

    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE portfolio_items (id INTEGER PRIMARY KEY, created_at DATETIME NOT NULL)"))
        connection.execute(text("INSERT INTO portfolio_items (id, created_at) VALUES (1, '2026-01-01'), (2, '2026-02-01'), (3, '2026-01-15')"))
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(portfolio_items)"))}
        assert {"logo_url", "position", "style", "blocks"}.issubset(columns)
        positions = dict(connection.execute(text("SELECT id, position FROM portfolio_items")).all())
        assert positions == {2: 0, 3: 1, 1: 2}
        assert connection.execute(text("SELECT style, blocks FROM portfolio_items WHERE id = 1")).fetchone() == ("{}", "[]")
        with Operations.context(context):
            migration.downgrade()
        downgraded = {row[1] for row in connection.execute(text("PRAGMA table_info(portfolio_items)"))}
        assert not {"logo_url", "position", "style", "blocks"}.intersection(downgraded)
    engine.dispose()
