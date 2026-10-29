"""Listado paginado con contadores por estado (lo usan pedidos, postulaciones y soporte)."""
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
    order_by: tuple | None = None,
) -> dict[str, Any]:
    """Devuelve {"total", "items", "counts"}.

    - Por defecto orden descendente por created_at (desempate por id: los más nuevos primero).
    - Si el modelo tiene `deleted_at`, lo que está en la papelera NO aparece ni se cuenta.
    - total: respeta el filtro `status`.
    - counts: por estado, sobre toda la tabla visible (siempre trae todos los estados, con 0).
    """
    base = []
    if hasattr(model, "deleted_at"):
        base.append(model.deleted_at.is_(None))
    filters = [*base, *([model.status == status] if status is not None else [])]
    order = order_by or (model.created_at.desc(), model.id.desc())

    total = await db.scalar(select(func.count()).select_from(model).where(*filters))
    items = (
        await db.scalars(select(model).where(*filters).order_by(*order).offset(skip).limit(limit))
    ).all()

    counts = {member.value: 0 for member in status_enum}
    for row_status, n in (
        await db.execute(select(model.status, func.count()).where(*base).group_by(model.status))
    ).all():
        counts[row_status.value] = n

    return {"total": total or 0, "items": list(items), "counts": counts}
