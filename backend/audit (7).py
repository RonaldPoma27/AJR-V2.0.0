"""Registro de auditoría y bloqueos de IP: solo ADMIN."""
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Query, Request, Response
from sqlalchemy import func, or_, select

from app.api.deps import AdminUser, DBSession
from app.core.audit import log_event
from app.core.exceptions import AppError
from app.core.ip_guard import guard
from app.core.rate_limit import client_ip
from app.models import AuditLog
from app.schemas.audit import AuditFilters, AuditLogRead, AuditPage, AuditUser, IpBlockRead

router = APIRouter(prefix="/audit", tags=["audit"])

try:
    AR_TZ = ZoneInfo("America/Argentina/Buenos_Aires")
except ZoneInfoNotFoundError:  # sin tzdata: Argentina no usa horario de verano desde 2009
    AR_TZ = timezone(timedelta(hours=-3))
TZ_LABEL = "America/Argentina/Buenos_Aires (UTC-03:00)"


def _serialize(row: AuditLog) -> AuditLogRead:
    local = row.created_at.astimezone(AR_TZ)
    return AuditLogRead.model_validate(
        {
            **{c.key: getattr(row, c.key) for c in AuditLog.__table__.columns},
            "date_ar": local.strftime("%d/%m/%Y"),
            "time_ar": local.strftime("%H:%M:%S"),
            "timezone": TZ_LABEL,
        }
    )


def _day_start(day: date) -> datetime:
    """Medianoche argentina de ese día, en UTC."""
    return datetime.combine(day, time.min, tzinfo=AR_TZ).astimezone(timezone.utc)


@router.get("/logs", response_model=AuditPage)
async def list_logs(
    db: DBSession,
    _: AdminUser,
    user_id: Annotated[int | None, Query()] = None,
    action: Annotated[str | None, Query(max_length=40)] = None,
    entity: Annotated[str | None, Query(max_length=60)] = None,
    date_from: Annotated[date | None, Query()] = None,  # día argentino, inclusive
    date_to: Annotated[date | None, Query()] = None,  # día argentino, inclusive
    q: Annotated[str | None, Query(max_length=100)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
):
    """Más recientes primero. Las fechas se interpretan en hora argentina."""
    filters = []
    if user_id is not None:
        filters.append(AuditLog.user_id == user_id)
    if action:
        filters.append(AuditLog.action == action)
    if entity:
        filters.append(AuditLog.entity == entity)
    if date_from:
        filters.append(AuditLog.created_at >= _day_start(date_from))
    if date_to:
        filters.append(AuditLog.created_at < _day_start(date_to + timedelta(days=1)))
    if q:
        like = f"%{q.strip()}%"
        filters.append(
            or_(
                AuditLog.user_email.ilike(like),
                AuditLog.entity_label.ilike(like),
                AuditLog.ip.ilike(like),
                AuditLog.path.ilike(like),
                AuditLog.detail.ilike(like),
            )
        )

    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*filters))
    rows = (
        await db.scalars(
            select(AuditLog)
            .where(*filters)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()
    return AuditPage(total=total or 0, items=[_serialize(r) for r in rows])


@router.get("/filters", response_model=AuditFilters)
async def filter_options(db: DBSession, _: AdminUser):
    """Opciones para los desplegables de filtros (lo que realmente hay en el registro)."""
    users = (
        await db.execute(
            select(AuditLog.user_id, AuditLog.user_email)
            .where(AuditLog.user_email.is_not(None))
            .group_by(AuditLog.user_id, AuditLog.user_email)
            .order_by(AuditLog.user_email)
        )
    ).all()
    actions = (await db.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action))).all()
    entities = (
        await db.scalars(
            select(AuditLog.entity).where(AuditLog.entity.is_not(None)).distinct().order_by(AuditLog.entity)
        )
    ).all()
    return AuditFilters(
        users=[AuditUser(id=uid, email=email) for uid, email in users],
        actions=list(actions),
        entities=list(entities),
    )


@router.get("/blocks", response_model=list[IpBlockRead])
async def list_blocks(_: AdminUser):
    """IPs bloqueadas o baneadas en este momento."""
    return [
        IpBlockRead(
            ip=b.ip,
            kind=b.kind,
            reason=b.reason,
            retry_after=b.retry_after,
            blocked_until=datetime.fromtimestamp(b.until, tz=timezone.utc),
        )
        for b in guard.list_active()
    ]


@router.delete("/blocks/{ip}", status_code=204)
async def release_block(ip: str, request: Request, admin: AdminUser):
    """Levanta el bloqueo de una IP (queda en el registro de auditoría)."""
    if not await guard.release(ip, released_by=admin.id):
        raise AppError(404, "Esa IP no está bloqueada.")
    await log_event(
        "ip_released", user_id=admin.id, email=admin.email, role=admin.role.value,
        ip=client_ip(request), method="DELETE", path=request.url.path,
        entity="ip", entity_id=ip, entity_label=ip,
    )
    return Response(status_code=204)
