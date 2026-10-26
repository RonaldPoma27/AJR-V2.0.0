"""Auditoría automática de lo que hacen ADMIN y TECHNICIAN.

Cómo funciona: `get_current_user` deja en `session.info["audit_ctx"]` quién es, desde qué IP y
qué endpoint está usando (solo si es del equipo). Los listeners de abajo miran cada flush de esa
sesión y, por cada fila creada / modificada / borrada, escriben un AuditLog en la MISMA
transacción: si el cambio se revierte, el registro también. Así queda cubierto todo lo que
cambia la base, sin tocar cada endpoint.

Las contraseñas nunca se guardan (solo "cambió"). Los eventos que no son cambios de datos
(login, bloqueos de IP) se registran con `log_event`.
"""
import logging
from datetime import date, datetime
from enum import Enum
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.models.audit import AuditLog

logger = logging.getLogger("audit")

_SKIP_TABLES = {"audit_logs", "ip_blocks"}
_SECRET_FIELDS = {"hashed_password"}
_NOISE_FIELDS = {"updated_at", "created_at", "id"}
_LABEL_FIELDS = ("title", "name", "company", "subject", "full_name", "email", "slug")
_MAX_VALUE_LEN = 300


def _clean(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    text = str(value)
    return text if len(text) <= _MAX_VALUE_LEN else text[:_MAX_VALUE_LEN] + "…"


def _columns(obj: Any) -> list[str]:
    return [attr.key for attr in inspect(obj).mapper.column_attrs]


def _label(obj: Any) -> str | None:
    values = inspect(obj).dict
    for field in _LABEL_FIELDS:
        value = values.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()[:255]
    return None


def _entity_id(obj: Any) -> str | None:
    identity = inspect(obj).identity
    if identity:
        return "-".join(str(part) for part in identity)
    pk = inspect(obj).mapper.primary_key[0].key
    value = inspect(obj).dict.get(pk)
    return None if value is None else str(value)


def _snapshot(obj: Any, side: str) -> dict[str, Any]:
    """Valores cargados de la fila (sin disparar lecturas a la DB)."""
    values = inspect(obj).dict
    out: dict[str, Any] = {}
    for key in _columns(obj):
        if key in _NOISE_FIELDS or key not in values or values[key] is None:
            continue
        out[key] = {"changed": True} if key in _SECRET_FIELDS else {side: _clean(values[key])}
    return out


def _diff(obj: Any) -> dict[str, Any]:
    state = inspect(obj)
    out: dict[str, Any] = {}
    for key in _columns(obj):
        if key in _NOISE_FIELDS:
            continue
        history = state.attrs[key].history
        if not history.has_changes():
            continue
        old = history.deleted[0] if history.deleted else None
        new = history.added[0] if history.added else None
        if old == new:
            continue
        out[key] = (
            {"changed": True} if key in _SECRET_FIELDS else {"old": _clean(old), "new": _clean(new)}
        )
    return out


def _base_row(ctx: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": ctx["user_id"],
        "user_email": ctx["email"],
        "user_role": ctx["role"],
        "ip": ctx.get("ip"),
        "method": ctx.get("method"),
        "path": (ctx.get("path") or "")[:300] or None,
    }


@event.listens_for(Session, "before_flush")
def _collect_changes(session: Session, flush_context: Any, instances: Any) -> None:
    ctx = session.info.get("audit_ctx")
    pending: list[tuple[str, Any, dict[str, Any] | None]] = []
    session.info["_audit_pending"] = pending
    if not ctx:
        return

    for obj in session.dirty:
        if obj.__tablename__ in _SKIP_TABLES or not session.is_modified(obj):
            continue
        changes = _diff(obj)
        if not changes:
            continue
        action = "update"
        if "deleted_at" in changes:
            action = "restore" if changes["deleted_at"].get("new") is None else "trash"
        pending.append((action, obj, changes))

    for obj in session.deleted:
        if obj.__tablename__ not in _SKIP_TABLES:
            pending.append(("delete", obj, _snapshot(obj, "old")))

    for obj in session.new:
        if obj.__tablename__ not in _SKIP_TABLES:
            pending.append(("create", obj, None))  # los valores se leen tras el flush


@event.listens_for(Session, "after_flush")
def _write_entries(session: Session, flush_context: Any) -> None:
    ctx = session.info.get("audit_ctx")
    pending = session.info.pop("_audit_pending", None)
    if not ctx or not pending:
        return

    rows = []
    for action, obj, changes in pending:
        if action == "create":
            changes = _snapshot(obj, "new")
        rows.append(
            {
                **_base_row(ctx),
                "action": action,
                "entity": obj.__tablename__,
                "entity_id": _entity_id(obj),
                "entity_label": _label(obj),
                "changes": changes or None,
            }
        )
    # Insert directo en la conexión de la transacción en curso (no se puede session.add acá).
    session.connection().execute(AuditLog.__table__.insert(), rows)


async def log_event(
    action: str,
    *,
    user_id: int | None = None,
    email: str | None = None,
    role: str | None = None,
    ip: str | None = None,
    method: str | None = None,
    path: str | None = None,
    entity: str | None = None,
    entity_id: str | None = None,
    entity_label: str | None = None,
    detail: str | None = None,
) -> None:
    """Registra un evento suelto (login, bloqueo de IP...) en su propia transacción.
    Nunca rompe el request: si falla, solo se loguea."""
    from app.core.database import AsyncSessionLocal  # import tardío: evita ciclos

    try:
        async with AsyncSessionLocal() as session:
            session.add(
                AuditLog(
                    user_id=user_id,
                    user_email=email,
                    user_role=role,
                    action=action,
                    entity=entity,
                    entity_id=entity_id,
                    entity_label=entity_label,
                    ip=ip,
                    method=method,
                    path=path,
                    detail=detail,
                )
            )
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo registrar el evento de auditoría %s", action)
