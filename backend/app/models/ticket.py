from datetime import datetime

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, TimestampMixin
from app.models.enums import TicketStatus
from app.models.user import User


def ticket_status_type() -> SAEnum:
    return SAEnum(TicketStatus, name="ticket_status")


class Ticket(TimestampMixin, Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[TicketStatus] = mapped_column(
        ticket_status_type(),
        default=TicketStatus.PENDING,
        server_default=TicketStatus.PENDING.name,
        index=True,
    )
    estimated_cost: Mapped[float | None] = mapped_column(Float)

    # lazy="joined": el dueño viaja en la misma query (en async no se puede cargar "on demand").
    owner: Mapped[User] = relationship(lazy="joined")
    updates: Mapped[list["TicketUpdate"]] = relationship(
        back_populates="ticket",
        order_by="TicketUpdate.id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    comments: Mapped[list["TicketComment"]] = relationship(
        back_populates="ticket",
        order_by="TicketComment.id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TicketUpdate(CreatedAtMixin, Base):
    """Línea de tiempo: un registro por cada cambio de estado."""

    __tablename__ = "ticket_updates"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    previous_status: Mapped[TicketStatus | None] = mapped_column(ticket_status_type())
    new_status: Mapped[TicketStatus] = mapped_column(ticket_status_type())
    message: Mapped[str] = mapped_column(Text)

    ticket: Mapped[Ticket] = relationship(back_populates="updates")
    author: Mapped[User] = relationship(lazy="joined")


class TicketComment(CreatedAtMixin, Base):
    """Chat del ticket entre el cliente y el equipo técnico."""

    __tablename__ = "ticket_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)

    ticket: Mapped[Ticket] = relationship(back_populates="comments")
    author: Mapped[User] = relationship(lazy="joined")
