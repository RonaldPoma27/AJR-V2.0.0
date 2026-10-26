from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, StaffUser
from app.crud import ticket as crud_ticket
from app.models import TicketStatus
from app.schemas.ticket import (
    TicketCommentCreate,
    TicketCommentRead,
    TicketCreate,
    TicketDetail,
    TicketRead,
    TicketStatusUpdate,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.post("", response_model=TicketRead, status_code=201)
async def create_ticket(payload: TicketCreate, db: DBSession, current_user: CurrentUser):
    """Crea un ticket. El `user_id` sale del token, nunca del payload."""
    return await crud_ticket.create(db, owner=current_user, data=payload)


@router.get("", response_model=list[TicketRead])
async def list_tickets(
    db: DBSession,
    current_user: CurrentUser,
    status_filter: Annotated[TicketStatus | None, Query(alias="status")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    """USER: solo sus tickets. TECHNICIAN/ADMIN: todos."""
    return await crud_ticket.list_tickets(
        db,
        owner_id=None if current_user.is_staff else current_user.id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )


@router.get("/{ticket_id}", response_model=TicketDetail)
async def get_ticket(ticket_id: int, db: DBSession, current_user: CurrentUser):
    """Ticket con su línea de tiempo (`updates`) y su chat (`comments`)."""
    return await crud_ticket.get_accessible(db, ticket_id, current_user, with_details=True)


@router.patch("/{ticket_id}/status", response_model=TicketDetail)
async def change_ticket_status(
    ticket_id: int, payload: TicketStatusUpdate, db: DBSession, staff: StaffUser
):
    """Solo TECHNICIAN/ADMIN. Cambia el estado, opcionalmente fija `estimated_cost` y
    registra automáticamente un TicketUpdate en la línea de tiempo."""
    return await crud_ticket.change_status(db, ticket_id=ticket_id, actor=staff, data=payload)


@router.post("/{ticket_id}/approve", response_model=TicketDetail)
async def approve_ticket(ticket_id: int, db: DBSession, current_user: CurrentUser):
    """Exclusivo del cliente dueño del ticket: WAITING_APPROVAL → APPROVED."""
    return await crud_ticket.approve(db, ticket_id=ticket_id, actor=current_user)


@router.post("/{ticket_id}/comments", response_model=TicketCommentRead, status_code=201)
async def add_comment(
    ticket_id: int, payload: TicketCommentCreate, db: DBSession, current_user: CurrentUser
):
    """Cualquier involucrado (dueño, técnico o admin) puede escribir en el hilo."""
    ticket = await crud_ticket.get_accessible(db, ticket_id, current_user)
    return await crud_ticket.add_comment(
        db, ticket=ticket, author=current_user, content=payload.content
    )
