from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.deps import CurrentUser, DBSession, StaffUser
from app.core.rate_limit import enforce_rate_limit
from app.crud import support as crud_support
from app.crud.pagination import list_with_counts
from app.models import SupportTicket, SupportTicketStatus
from app.schemas.common import Page
from app.schemas.support import (
    SupportMessageCreate,
    SupportStatusUpdate,
    SupportTicketCreate,
    SupportTicketDetail,
    SupportTicketRead,
)

router = APIRouter(prefix="/support", tags=["support"])


@router.post("/tickets", response_model=SupportTicketDetail, status_code=201)
async def create_ticket(
    payload: SupportTicketCreate, request: Request, db: DBSession, current_user: CurrentUser
):
    """Inicia un chat: título + primer mensaje (máx. 2000 caracteres)."""
    enforce_rate_limit(request, "support")
    ticket_id = await crud_support.create_ticket(
        db, owner=current_user, title=payload.title, message=payload.message
    )
    return await crud_support.build_detail(db, ticket_id, current_user)


@router.get("/tickets/mine", response_model=list[SupportTicketRead])
async def list_my_tickets(db: DBSession, current_user: CurrentUser):
    """\"Historial de chats\" del usuario logueado."""
    return await crud_support.list_for_user(db, current_user.id)


@router.get("/tickets", response_model=Page[SupportTicketRead])
async def list_tickets(
    db: DBSession,
    _: StaffUser,
    status_filter: Annotated[SupportTicketStatus | None, Query(alias="status")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """TECHNICIAN y ADMIN: todos los chats, con contadores por estado. Los que esperan
    respuesta hace más tiempo van primero entre los abiertos (más antiguo → más nuevo)."""
    return await list_with_counts(
        db,
        SupportTicket,
        SupportTicketStatus,
        status=status_filter,
        skip=skip,
        limit=limit,
        order_by=(SupportTicket.last_message_at.desc(), SupportTicket.id.desc()),
    )


@router.get("/tickets/{ticket_id}", response_model=SupportTicketDetail)
async def get_ticket(ticket_id: int, db: DBSession, current_user: CurrentUser):
    """El dueño o el equipo. Para cualquier otra persona es un 404 (no revela que existe)."""
    return await crud_support.build_detail(db, ticket_id, current_user)


@router.post("/tickets/{ticket_id}/messages", response_model=SupportTicketDetail, status_code=201)
async def send_message(
    ticket_id: int, payload: SupportMessageCreate, db: DBSession, current_user: CurrentUser
):
    """Responde 409 si el cliente ya mandó 2 mensajes seguidos sin respuesta del equipo."""
    await crud_support.send_message(
        db, ticket_id=ticket_id, sender=current_user, content=payload.content
    )
    return await crud_support.build_detail(db, ticket_id, current_user)


@router.patch("/tickets/{ticket_id}", response_model=SupportTicketDetail)
async def update_ticket_status(
    ticket_id: int, payload: SupportStatusUpdate, db: DBSession, staff: StaffUser
):
    """TECHNICIAN y ADMIN: cerrar, reabrir o marcar el estado de un chat."""
    await crud_support.set_status(db, ticket_id=ticket_id, status=payload.status)
    return await crud_support.build_detail(db, ticket_id, staff)
