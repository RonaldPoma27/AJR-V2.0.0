from datetime import datetime, timezone

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Nombres deterministas para constraints e índices (facilita migraciones con Alembic).
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now()
    )


class TimestampMixin(CreatedAtMixin):
    # Los defaults/onupdate de Python dejan el valor cargado en el objeto tras el flush,
    # así no hace falta un refresh (que en async provocaría un lazy-load).
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=func.now()
    )


class SoftDeleteMixin:
    """Borrado lógico: `deleted_at` con fecha = está en la papelera.

    Un job periódico (app/core/scheduler.py) elimina de verdad lo que lleva más de
    TRASH_RETENTION_DAYS (30 por defecto) en la papelera.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
