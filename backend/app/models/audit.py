"""Auditoría de acciones del equipo (ADMIN / TECHNICIAN) y bloqueos de IP."""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin


class AuditLog(CreatedAtMixin, Base):
    """Una fila por acción. `created_at` se guarda en UTC (timestamptz); la zona horaria
    de Argentina se aplica al mostrarlo (frontend y exportaciones)."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_created_at_id", "created_at", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Quién: se guarda también email/rol "congelados" por si la cuenta cambia o se borra.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    user_email: Mapped[str | None] = mapped_column(String(255), index=True)
    user_role: Mapped[str | None] = mapped_column(String(20))
    # Qué: create | update | delete | trash | restore | login | login_failed | ip_locked | ip_banned | ...
    action: Mapped[str] = mapped_column(String(40), index=True)
    entity: Mapped[str | None] = mapped_column(String(60), index=True)  # nombre de tabla
    entity_id: Mapped[str | None] = mapped_column(String(40))
    entity_label: Mapped[str | None] = mapped_column(String(255))
    # Cambios: {"campo": {"old": ..., "new": ...}} (create: solo "new").
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # Desde dónde.
    ip: Mapped[str | None] = mapped_column(String(64))
    method: Mapped[str | None] = mapped_column(String(10))
    path: Mapped[str | None] = mapped_column(String(300))
    detail: Mapped[str | None] = mapped_column(Text)


class IpBlock(CreatedAtMixin, Base):
    """Bloqueo/baneo de una IP. Se persiste para sobrevivir a reinicios del servidor."""

    __tablename__ = "ip_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # "login_lock" | "flood_ban"
    reason: Mapped[str | None] = mapped_column(String(255))
    blocked_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    released_by: Mapped[int | None] = mapped_column(Integer)
