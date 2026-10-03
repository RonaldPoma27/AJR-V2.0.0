from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.pagination import list_with_counts
from app.models import ClientOrder, OrderStatus


async def create(db: AsyncSession, data: dict[str, Any], *, user_id: int) -> ClientOrder:
    order = ClientOrder(**data, user_id=user_id)
    db.add(order)
    await db.commit()
    return order


async def get(db: AsyncSession, order_id: int) -> ClientOrder | None:
    """Solo pedidos activos: uno que está en la papelera se comporta como inexistente."""
    order = await db.get(ClientOrder, order_id)
    return order if order is not None and order.deleted_at is None else None


async def list_orders(
    db: AsyncSession, *, status: OrderStatus | None, skip: int, limit: int
) -> dict[str, Any]:
    return await list_with_counts(db, ClientOrder, OrderStatus, status=status, skip=skip, limit=limit)


async def list_for_user(db: AsyncSession, user_id: int) -> Sequence[ClientOrder]:
    stmt = (
        select(ClientOrder)
        .where(ClientOrder.user_id == user_id, ClientOrder.deleted_at.is_(None))
        .order_by(ClientOrder.created_at.desc(), ClientOrder.id.desc())
        .limit(100)
    )
    return (await db.scalars(stmt)).all()


async def set_status(db: AsyncSession, order: ClientOrder, status: OrderStatus) -> ClientOrder:
    order.status = status
    await db.commit()
    return order
