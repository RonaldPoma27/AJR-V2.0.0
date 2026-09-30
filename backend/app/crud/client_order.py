from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.pagination import list_with_counts
from app.models import ClientOrder, OrderStatus


async def create(db: AsyncSession, data: dict[str, Any]) -> ClientOrder:
    order = ClientOrder(**data)
    db.add(order)
    await db.commit()
    return order


async def get(db: AsyncSession, order_id: int) -> ClientOrder | None:
    return await db.get(ClientOrder, order_id)


async def list_orders(
    db: AsyncSession, *, status: OrderStatus | None, skip: int, limit: int
) -> dict[str, Any]:
    return await list_with_counts(db, ClientOrder, OrderStatus, status=status, skip=skip, limit=limit)


async def set_status(db: AsyncSession, order: ClientOrder, status: OrderStatus) -> ClientOrder:
    order.status = status
    await db.commit()
    return order
