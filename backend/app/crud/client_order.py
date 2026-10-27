from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
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


PLAN_KEYS = ("presencia-digital", "web-gestion", "sistema-medida")


async def stats(db: AsyncSession, *, months: int = 12) -> dict[str, Any]:
    """Conteos para el dashboard. Todo sobre pedidos activos (deleted_at IS NULL)."""
    active = ClientOrder.deleted_at.is_(None)

    # Por mes: se arma la ventana completa (con 0) para que el gráfico no tenga huecos.
    month_expr = func.to_char(ClientOrder.created_at, "YYYY-MM")
    rows = (
        await db.execute(select(month_expr, func.count()).where(active).group_by(month_expr))
    ).all()
    found = {m: n for m, n in rows}
    today = datetime.now(timezone.utc)
    window: list[str] = []
    year, month = today.year, today.month
    for _ in range(months):
        window.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    window.reverse()

    by_status = {s.value: 0 for s in OrderStatus}
    for st, n in (
        await db.execute(select(ClientOrder.status, func.count()).where(active).group_by(ClientOrder.status))
    ).all():
        by_status[st.value] = n

    by_plan = {k: 0 for k in PLAN_KEYS} | {"sin-plan": 0}
    for plan, n in (
        await db.execute(select(ClientOrder.plan, func.count()).where(active).group_by(ClientOrder.plan))
    ).all():
        by_plan[plan if plan in PLAN_KEYS else "sin-plan"] += n

    by_domain = {"si": 0, "no": 0, "sin-dato": 0}
    for has, n in (
        await db.execute(select(ClientOrder.has_domain, func.count()).where(active).group_by(ClientOrder.has_domain))
    ).all():
        by_domain["sin-dato" if has is None else ("si" if has else "no")] += n

    return {
        "by_month": [{"month": m, "count": found.get(m, 0)} for m in window],
        "by_status": by_status,
        "by_plan": by_plan,
        "by_domain": by_domain,
    }
