"""Persistence only. All writers use account locks, then address locks."""
import hashlib
from datetime import timedelta
from sqlalchemy import delete, select, text
from app.models import User
from app.models.backup_email import BackupEmail, BackupEmailChallenge, BackupEmailRateEvent
from app.models.base import utcnow
from app.core.exceptions import AppError


async def lock_key(db, key: str):
    number = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big", signed=True)
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": number})


async def lock_user(db, user_id):
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True))
    if user is None:
        raise AppError(401, "Authentication required")
    return user


async def check_address(db, email):
    # Shared with primary registration/change so cross-table uniqueness is race safe.
    await lock_key(db, "email:" + email)
    if await db.scalar(select(User.id).where(User.email == email)) is not None or \
       await db.scalar(select(BackupEmail.user_id).where(BackupEmail.email == email)) is not None:
        raise AppError(409, "backup_address_unavailable")


async def active(db, user_id):
    return await db.scalar(select(BackupEmail).where(BackupEmail.user_id == user_id).execution_options(populate_existing=True))


async def challenge(db, user_id):
    return await db.scalar(select(BackupEmailChallenge).where(BackupEmailChallenge.user_id == user_id).execution_options(populate_existing=True))


async def clear_challenge(db, user_id):
    await db.execute(delete(BackupEmailChallenge).where(BackupEmailChallenge.user_id == user_id))


async def purge(db):
    # Expired challenges remain visible for 24h to allow resend, then are removed.
    now = utcnow()
    await db.execute(delete(BackupEmailChallenge).where(BackupEmailChallenge.expires_at < now - timedelta(days=1)))
    await db.execute(delete(BackupEmailRateEvent).where(BackupEmailRateEvent.created_at < now - timedelta(hours=2)))
    await db.commit()
