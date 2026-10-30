"""Manual cleanup when the scheduler is disabled: python -m app.scripts.purge_backup_email."""
import asyncio
from app.core.database import AsyncSessionLocal, engine
from app.crud.backup_email import purge

async def main():
    async with AsyncSessionLocal() as db:
        await purge(db)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
