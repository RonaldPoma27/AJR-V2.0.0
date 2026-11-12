"""Cola durable de correo transaccional (outbox)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, utcnow


class EmailOutbox(CreatedAtMixin, Base):
    """Notificación que se entrega fuera de la transacción principal.

    La fila se crea en la misma transacción que la solicitud de arrepentimiento. El worker
    la reintenta hasta que el transporte confirme el envío. El modelo ofrece entrega
    *at-least-once*: ante una caída justo después de que SMTP acepte el mensaje podría
    repetirse el correo al reintentar.
    """

    __tablename__ = "email_outbox"
    __table_args__ = (
        Index("ix_email_outbox_status_next_attempt", "status", "next_attempt_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    dedupe_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("client_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    recipient: Mapped[str] = mapped_column(String(320), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING", server_default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_alerted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
