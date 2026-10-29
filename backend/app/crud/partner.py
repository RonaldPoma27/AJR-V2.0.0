from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Partner


async def get(db: AsyncSession, partner_id: int) -> Partner | None:
    return await db.get(Partner, partner_id)


async def get_multi(db: AsyncSession, *, skip: int = 0, limit: int = 100) -> Sequence[Partner]:
    stmt = select(Partner).order_by(Partner.created_at.desc(), Partner.id.desc()).offset(skip).limit(limit)
    return (await db.scalars(stmt)).all()


async def create(db: AsyncSession, payload: BaseModel) -> Partner:
    partner = Partner(**payload.model_dump())
    db.add(partner)
    await db.commit()
    return partner


async def update(db: AsyncSession, partner: Partner, payload: BaseModel) -> Partner:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(partner, field, value)
    await db.commit()
    return partner


async def remove(db: AsyncSession, partner: Partner) -> None:
    await db.delete(partner)
    await db.commit()
