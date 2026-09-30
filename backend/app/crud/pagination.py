"""Listado paginado con contadores por estado (lo usan pedidos y postulaciones)."""
import enum
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def list_with_counts(
    db: AsyncSession,
    model: Any,
    status_enum: type[enum.Enum],
    *,
    status: enum.Enum | None = None,
    skip: int = 0,
    limit: int = 20,
) -> dict[str, Any]:
    """Devuelve {"total", "items", "counts"}.

    - Orden descendente por created_at (desempate por id: los más nuevos primero).
    - total: respeta el filtro `status`.
    - counts: por estado, sobre toda la tabla (siempre trae todos los estados, con 0).
    """
    filters = [model.status == status] if status is not None else []

    total = await db.scalar(select(func.count()).select_from(model).where(*filters))
    items = (
        await db.scalars(
            select(model)
            .where(*filters)
            .order_by(model.created_at.desc(), model.id.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()

    counts = {member.value: 0 for member in status_enum}
    for row_status, n in (
        await db.execute(select(model.status, func.count()).group_by(model.status))
    ).all():
        counts[row_status.value] = n

    return {"total": total or 0, "items": list(items), "counts": counts}
