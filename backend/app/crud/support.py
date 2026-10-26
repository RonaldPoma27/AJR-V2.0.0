"""Chat de soporte.

Regla de negocio central: el cliente puede mandar como máximo 2 mensajes seguidos. Si el
equipo (ADMIN/TECHNICIAN) no respondió, el 3.º se rechaza. Se valida acá, en el backend; el
frontend solo refleja `can_send`.
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppError
from app.models import SupportMessage, SupportTicket, SupportTicketStatus, User
from app.models.base import utcnow
from app.models.enums import SupportTicketStatus as S

MAX_CONSECUTIVE_CUSTOMER_MESSAGES = 2
NOT_FOUND = "Chat no encontrado"
LOCKED_MESSAGE = (
    f"Ya enviaste {MAX_CONSECUTIVE_CUSTOMER_MESSAGES} mensajes seguidos. "
    "Esperá la respuesta del equipo de soporte para escribir de nuevo."
)


def can_access(user: User, ticket: SupportTicket) -> bool:
    return user.is_staff or ticket.user_id == user.id


# --------------------------------------------------------------------------- lecturas
async def _trailing_customer_messages(db: AsyncSession, ticket: SupportTicket) -> int:
    """Cuántos de los últimos mensajes seguidos son del cliente (se corta en el primero del equipo)."""
    sender_ids = (
        await db.scalars(
            select(SupportMessage.sender_id)
            .where(SupportMessage.ticket_id == ticket.id)
            .order_by(SupportMessage.id.desc())
            .limit(MAX_CONSECUTIVE_CUSTOMER_MESSAGES)
        )
    ).all()
    count = 0
    for sender_id in sender_ids:
        if sender_id != ticket.user_id:
            break
        count += 1
    return count


async def build_detail(db: AsyncSession, ticket_id: int, viewer: User) -> dict[str, Any]:
    """Ticket + mensajes + `can_send` para quien lo mira."""
    ticket = await db.scalar(
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id)
        .options(selectinload(SupportTicket.messages))
        .execution_options(populate_existing=True)
    )
    if ticket is None or not can_access(viewer, ticket):
        raise AppError(404, NOT_FOUND)

    block_reason = None
    if ticket.status == S.CERRADO:
        block_reason = "closed"
    elif viewer.id == ticket.user_id and (
        await _trailing_customer_messages(db, ticket) >= MAX_CONSECUTIVE_CUSTOMER_MESSAGES
    ):
        block_reason = "awaiting_support"

    messages = [
        {
            "id": m.id,
            "ticket_id": m.ticket_id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.full_name or "Usuario",
            "from_customer": m.sender_id == ticket.user_id,
            "content": m.content,
            "created_at": m.created_at,
        }
        for m in ticket.messages
    ]
    return {
        **{c: getattr(ticket, c) for c in (
            "id", "user_id", "owner", "title", "status", "created_at", "updated_at",
            "last_message_at", "first_response_at",
        )},
        "messages": messages,
        "can_send": block_reason is None,
        "block_reason": block_reason,
    }


async def list_for_user(db: AsyncSession, user_id: int) -> list[SupportTicket]:
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.user_id == user_id)
        .order_by(SupportTicket.last_message_at.desc(), SupportTicket.id.desc())
        .limit(200)
    )
    return list((await db.scalars(stmt)).all())


# ------------------------------------------------------------------------- escrituras
async def _get_for_update(db: AsyncSession, ticket_id: int) -> SupportTicket | None:
    # FOR UPDATE serializa mensajes simultáneos del mismo chat: sin esto, dos requests en
    # paralelo podrían pasar la regla de "máx. 2 seguidos". `of=` porque el owner va en un JOIN.
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id)
        .with_for_update(of=SupportTicket)
        .execution_options(populate_existing=True)
    )
    return await db.scalar(stmt)


async def create_ticket(db: AsyncSession, *, owner: User, title: str, message: str) -> int:
    ticket = SupportTicket(owner=owner, title=title)
    db.add(ticket)
    await db.flush()
    db.add(SupportMessage(ticket_id=ticket.id, sender=owner, content=message))
    await db.commit()
    return ticket.id


async def send_message(db: AsyncSession, *, ticket_id: int, sender: User, content: str) -> None:
    ticket = await _get_for_update(db, ticket_id)
    if ticket is None or not can_access(sender, ticket):
        raise AppError(404, NOT_FOUND)
    if ticket.status == S.CERRADO:
        raise AppError(409, "Este chat está cerrado.")

    from_customer = sender.id == ticket.user_id
    if from_customer and (
        await _trailing_customer_messages(db, ticket) >= MAX_CONSECUTIVE_CUSTOMER_MESSAGES
    ):
        raise AppError(409, LOCKED_MESSAGE)

    now = utcnow()
    db.add(SupportMessage(ticket_id=ticket.id, sender=sender, content=content))
    ticket.last_message_at = now
    ticket.updated_at = now
    if from_customer:
        ticket.status = SupportTicketStatus.ABIERTO
    else:
        ticket.status = SupportTicketStatus.RESPONDIDO
        if ticket.first_response_at is None:
            ticket.first_response_at = now
    await db.commit()


async def set_status(db: AsyncSession, *, ticket_id: int, status: SupportTicketStatus) -> None:
    ticket = await _get_for_update(db, ticket_id)
    if ticket is None:
        raise AppError(404, NOT_FOUND)
    ticket.status = status
    await db.commit()
