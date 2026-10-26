from collections.abc import Sequence
from typing import Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cms import CMSBase

ModelT = TypeVar("ModelT", bound=CMSBase)


class CRUDBase(Generic[ModelT]):
    """CRUD asíncrono genérico para los modelos del CMS."""

    def __init__(self, model: type[ModelT]) -> None:
        self.model = model

    async def get(self, db: AsyncSession, item_id: int) -> ModelT | None:
        return await db.get(self.model, item_id)

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 50
    ) -> Sequence[ModelT]:
        stmt = (
            select(self.model)
            .order_by(self.model.created_at.desc(), self.model.id.desc())
            .offset(skip)
            .limit(limit)
        )
        return (await db.scalars(stmt)).all()

    async def create(self, db: AsyncSession, payload: BaseModel) -> ModelT:
        obj = self.model(**payload.model_dump())
        db.add(obj)
        await db.commit()
        return obj

    async def update(self, db: AsyncSession, obj: ModelT, payload: BaseModel) -> ModelT:
        for field, value in payload.model_dump().items():
            setattr(obj, field, value)
        await db.commit()
        return obj

    async def remove(self, db: AsyncSession, obj: ModelT) -> None:
        await db.delete(obj)
        await db.commit()
