from collections.abc import Sequence
from typing import Any

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.pagination import list_with_counts
from app.models import ClientOrder, OrderStatus
from app.schemas.client_order import PLAN_BASE_PRICE_USD


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


async def update(
    db: AsyncSession,
    order: ClientOrder,
    *,
    status: OrderStatus | None = None,
    project_step: int | None = None,
) -> ClientOrder:
    if status is not None:
        order.status = status
    if project_step is not None:
        order.project_step = project_step
    await db.commit()
    return order


def _last_months(n: int, today: datetime) -> list[str]:
    """Los últimos `n` meses (el actual incluido), del más viejo al más nuevo: "YYYY-MM"."""
    year, month = today.year, today.month
    out: list[str] = []
    for _ in range(n):
        out.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return out[::-1]


async def stats(db: AsyncSession, *, months: int = 12) -> dict[str, Any]:
    """Agregados para el dashboard. Pedidos activos (sin papelera); los descartados no cuentan
    como proyectos activos pero sí como solicitudes recibidas en `by_month`."""
    live = ClientOrder.deleted_at.is_(None)
    active = (live, ClientOrder.status != OrderStatus.DESCARTADO)

    month_key = func.to_char(func.timezone("UTC", ClientOrder.created_at), "YYYY-MM")
    per_month = dict(
        (await db.execute(select(month_key, func.count()).where(live).group_by(month_key))).all()
    )
    by_month = [
        {"month": m, "count": per_month.get(m, 0)}
        for m in _last_months(months, datetime.now(timezone.utc))
    ]

    per_plan = dict(
        (
            await db.execute(
                select(ClientOrder.plan, func.count())
                .where(*active, ClientOrder.plan.is_not(None))
                .group_by(ClientOrder.plan)
            )
        ).all()
    )
    by_plan = [
        {"plan": plan, "count": per_plan.get(plan, 0), "estimated_usd": per_plan.get(plan, 0) * price}
        for plan, price in PLAN_BASE_PRICE_USD.items()
    ]

    per_step = dict(
        (
            await db.execute(
                select(ClientOrder.project_step, func.count()).where(*active).group_by(ClientOrder.project_step)
            )
        ).all()
    )
    by_step = [{"step": s, "count": per_step.get(s, 0)} for s in range(1, 6)]

    per_domain = dict(
        (
            await db.execute(
                select(ClientOrder.has_domain, func.count())
                .where(*active, ClientOrder.has_domain.is_not(None))
                .group_by(ClientOrder.has_domain)
            )
        ).all()
    )
    total = await db.scalar(select(func.count()).select_from(ClientOrder).where(*active))
    return {
        "by_month": by_month,
        "by_plan": by_plan,
        "by_step": by_step,
        "domain": {
            "own_domain": per_domain.get(True, 0),
            "needs_hosting": per_domain.get(False, 0),
        },
        "total": total or 0,
    }
