"""Papelera: borrado lógico, restauración y limpieza definitiva de pedidos y postulaciones."""
from datetime import datetime, timedelta
from typing import Any, Literal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import ClientOrder, JobApplication
from app.models.base import utcnow

Kind = Literal["order", "application"]
MODELS: dict[str, Any] = {"order": ClientOrder, "application": JobApplication}
LIST_LIMIT = 500


def retention() -> timedelta:
    return timedelta(days=settings.TRASH_RETENTION_DAYS)


async def get_any(db: AsyncSession, kind: Kind, item_id: int) -> Any | None:
    """Trae el elemento esté o no en la papelera."""
    return await db.get(MODELS[kind], item_id)


async def soft_delete(db: AsyncSession, obj: Any) -> None:
    obj.deleted_at = utcnow()
    await db.commit()


async def restore(db: AsyncSession, obj: Any) -> None:
    obj.deleted_at = None
    await db.commit()


def _item(kind: Kind, obj: Any, now: datetime) -> dict[str, Any]:
    if kind == "order":
        title, subtitle = obj.company_name, f"Pedido de {obj.contact_name} · {obj.industry}"
    else:
        title, subtitle = obj.full_name, f"Postulación · {obj.area} · {obj.location}"
    purge_at = obj.deleted_at + retention()
    return {
        "kind": kind,
        "id": obj.id,
        "title": title,
        "subtitle": subtitle,
        "deleted_at": obj.deleted_at,
        "purge_at": purge_at,
        "seconds_left": max(0, int((purge_at - now).total_seconds())),
    }


async def list_trash(db: AsyncSession) -> list[dict[str, Any]]:
    now = utcnow()
    items: list[dict[str, Any]] = []
    for kind, model in MODELS.items():
        rows = await db.scalars(
            select(model).where(model.deleted_at.is_not(None)).limit(LIST_LIMIT)
        )
        items.extend(_item(kind, row, now) for row in rows)  # type: ignore[arg-type]
    items.sort(key=lambda i: i["deleted_at"], reverse=True)
    return items[:LIST_LIMIT]


async def purge_expired(db: AsyncSession) -> int:
    """Borra de verdad lo que lleva más de TRASH_RETENTION_DAYS en la papelera."""
    cutoff = utcnow() - retention()
    removed = 0
    for model in MODELS.values():
        result = await db.execute(delete(model).where(model.deleted_at < cutoff))
        removed += result.rowcount or 0
    await db.commit()
    return removed
