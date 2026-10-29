"""Acceso a datos de correo de respaldo y desafíos."""
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.backup_email import BackupEmail, BackupEmailChallenge


async def list_for_user(db: AsyncSession, user_id: int, *, for_update: bool = False) -> list[BackupEmail]:
    stmt = select(BackupEmail).where(BackupEmail.user_id == user_id).order_by(BackupEmail.id)
    if for_update:
        stmt = stmt.with_for_update()
    return list((await db.scalars(stmt)).all())


async def get_pending_challenge(
    db: AsyncSession, user_id: int, *, for_update: bool = False
) -> BackupEmailChallenge | None:
    stmt = (
        select(BackupEmailChallenge)
        .where(
            BackupEmailChallenge.user_id == user_id,
            BackupEmailChallenge.purpose == "VERIFY_BACKUP_EMAIL",
            BackupEmailChallenge.consumed_at.is_(None),
            BackupEmailChallenge.invalidated_at.is_(None),
        )
        .order_by(BackupEmailChallenge.created_at.desc(), BackupEmailChallenge.id.desc())
        .limit(1)
    )
    if for_update:
        stmt = stmt.with_for_update()
    return await db.scalar(stmt)


async def invalidate_open_challenges(db: AsyncSession, user_id: int, now: datetime) -> None:
    await db.execute(
        BackupEmailChallenge.__table__.update()
        .where(
            BackupEmailChallenge.user_id == user_id,
            BackupEmailChallenge.purpose == "VERIFY_BACKUP_EMAIL",
            BackupEmailChallenge.consumed_at.is_(None),
            BackupEmailChallenge.invalidated_at.is_(None),
        )
        .values(invalidated_at=now)
    )


async def purge_old_challenges(db: AsyncSession, cutoff: datetime) -> int:
    result = await db.execute(delete(BackupEmailChallenge).where(BackupEmailChallenge.created_at < cutoff))
    return result.rowcount or 0
