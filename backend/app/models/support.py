from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, TimestampMixin, utcnow
from app.models.enums import SupportTicketStatus, value_enum
from app.models.user import User

# Límite duro del largo de un mensaje (también se valida en el schema y con un CHECK en la DB).
MAX_MESSAGE_LENGTH = 2000


class SupportTicket(TimestampMixin, Base):
    """Chat de soporte de un cliente con el equipo (distinto de `Ticket`, el de la v1)."""

    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[SupportTicketStatus] = mapped_column(
        value_enum(SupportTicketStatus, "support_ticket_status"),
        default=SupportTicketStatus.ABIERTO,
        server_default=SupportTicketStatus.ABIERTO.value,
        index=True,
    )
    # Métricas de tiempo para el panel: desde cuándo espera respuesta y cuánto tardó la primera.
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now()
    )
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    owner: Mapped[User] = relationship(lazy="joined")
    messages: Mapped[list["SupportMessage"]] = relationship(
        back_populates="ticket",
        order_by="SupportMessage.id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class SupportMessage(CreatedAtMixin, Base):
    __tablename__ = "support_messages"
    __table_args__ = (
        CheckConstraint(
            f"char_length(content) <= {MAX_MESSAGE_LENGTH} AND char_length(btrim(content)) > 0",
            name="content_length",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("support_tickets.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)

    ticket: Mapped[SupportTicket] = relationship(back_populates="messages")
    sender: Mapped[User] = relationship(lazy="joined")
