"""Destructive migration roundtrip on a disposable *test* database only."""
import asyncio
import os
import subprocess
import sys
from sqlalchemy import text

if "test" not in os.environ.get("DATABASE_URL", "").rsplit("/",1)[-1].split("?")[0]:
    raise RuntimeError("Disposable test database required")
from app.core.database import AsyncSessionLocal, engine

async def snapshot():
    async with AsyncSessionLocal() as db:
        rows=(await db.execute(text("SELECT id, email, hashed_password, role FROM users ORDER BY id"))).all()
    await engine.dispose()
    return [tuple(row) for row in rows]

async def seed_legacy():
    async with AsyncSessionLocal() as db:
        await db.execute(text("INSERT INTO users (email, hashed_password, role) VALUES ('migration@example.com', 'test-only-inert-hash', 'USER') ON CONFLICT (email) DO NOTHING"))
        await db.commit()
    await engine.dispose()
asyncio.run(seed_legacy())
before=asyncio.run(snapshot())
subprocess.run([sys.executable,"-m","alembic","downgrade","0005_order_plan_fields"],check=True)
assert asyncio.run(snapshot()) == before
subprocess.run([sys.executable,"-m","alembic","upgrade","head"],check=True)
assert asyncio.run(snapshot()) == before
async def check():
    async with AsyncSessionLocal() as db:
        for table in ("backup_emails","backup_email_challenges","backup_email_rate_events"):
            assert await db.scalar(text(f"SELECT count(*) FROM {table}")) == 0
        assert await db.scalar(text("SELECT version_num FROM alembic_version")) == "0007_agile_projects"
    await engine.dispose()
asyncio.run(check())
print("Migration roundtrip OK: existing accounts preserved; new tables empty")
