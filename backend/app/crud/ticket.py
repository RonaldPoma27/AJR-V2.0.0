from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppError
from app.models import Ticket, TicketComment, TicketStatus, TicketUpdate, User
from app.models.base import utcnow
from app.schemas.ticket import TicketCreate, TicketStatusUpdate

S = TicketStatus

# Transiciones que puede hacer el equipo técnico con PATCH /tickets/{id}/status.
# APPROVED no aparece como destino: solo el cliente dueño lo alcanza (POST /tickets/{id}/approve).
ALLOWED_TRANSITIONS: dict[TicketStatus, set[TicketStatus]] = {
    S.PENDING: {S.DIAGNOSING, S.CLOSED},
    S.DIAGNOSING: {S.WAITING_APPROVAL, S.CLOSED},
    S.WAITING_APPROVAL: {S.DIAGNOSING, S.CLOSED},
    S.APPROVED: {S.IN_PROGRESS, S.CLOSED},
    S.IN_PROGRESS: {S.RESOLVED, S.DIAGNOSING, S.CLOSED},
    S.RESOLVED: {S.IN_PROGRESS, S.CLOSED},
    S.CLOSED: set(),
}

# El costo solo se puede tocar antes de que el cliente apruebe el presupuesto.
COST_EDITABLE_STATUSES = {S.DIAGNOSING, S.WAITING_APPROVAL}

NOT_FOUND = "Ticket no encontrado"


# --------------------------------------------------------------------------- lecturas
def can_access(user: User, ticket: Ticket) -> bool:
    return user.is_staff or ticket.user_id == user.id


async def get_detail(db: AsyncSession, ticket_id: int) -> Ticket | None:
    """Ticket + timeline + comentarios (eager loading: en async no hay lazy-load)."""
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.updates), selectinload(Ticket.comments))
        .execution_options(populate_existing=True)
    )
    return await db.scalar(stmt)


async def get_accessible(
    db: AsyncSession, ticket_id: int, user: User, *, with_details: bool = False
) -> Ticket:
    """Devuelve el ticket si el usuario puede verlo. Si no, 404 (no revela que existe)."""
    ticket = await (get_detail(db, ticket_id) if with_details else db.get(Ticket, ticket_id))
    if ticket is None or not can_access(user, ticket):
        raise AppError(404, NOT_FOUND)
    return ticket


async def list_tickets(
    db: AsyncSession,
    *,
    owner_id: int | None = None,
    status: TicketStatus | None = None,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[Ticket]:
    stmt = select(Ticket).order_by(Ticket.updated_at.desc(), Ticket.id.desc())
    if owner_id is not None:
        stmt = stmt.where(Ticket.user_id == owner_id)
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    return (await db.scalars(stmt.offset(skip).limit(limit))).all()


async def _get_for_update(db: AsyncSession, ticket_id: int) -> Ticket | None:
    # FOR UPDATE serializa cambios concurrentes (p. ej. técnico cambia el estado mientras el
    # cliente aprueba). `of=Ticket` es necesario porque el owner viaja en un LEFT JOIN.
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .with_for_update(of=Ticket)
        .execution_options(populate_existing=True)
    )
    return await db.scalar(stmt)


async def _reload_detail(db: AsyncSession, ticket_id: int) -> Ticket:
    ticket = await get_detail(db, ticket_id)
    if ticket is None:  # no debería pasar: recién se modificó
        raise AppError(404, NOT_FOUND)
    return ticket


# ------------------------------------------------------------------------- escrituras
async def create(db: AsyncSession, *, owner: User, data: TicketCreate) -> Ticket:
    ticket = Ticket(owner=owner, title=data.title, description=data.description)
    db.add(ticket)
    await db.flush()  # obtiene ticket.id para el primer evento de la línea de tiempo

    db.add(
        TicketUpdate(
            ticket_id=ticket.id,
            author=owner,
            previous_status=None,
            new_status=TicketStatus.PENDING,
            message="Ticket creado",
        )
    )
    await db.commit()
    return ticket


async def change_status(
    db: AsyncSession, *, ticket_id: int, actor: User, data: TicketStatusUpdate
) -> Ticket:
    ticket = await _get_for_update(db, ticket_id)
    if ticket is None:
        raise AppError(404, NOT_FOUND)

    previous, new = ticket.status, data.status

    if new == TicketStatus.APPROVED:
        raise AppError(
            403, "Solo el cliente dueño puede aprobar el presupuesto (POST /tickets/{id}/approve)."
        )
    if new not in ALLOWED_TRANSITIONS[previous]:
        allowed = ", ".join(sorted(s.value for s in ALLOWED_TRANSITIONS[previous])) or "ninguna"
        raise AppError(
            409,
            f"Transición no permitida: {previous.value} → {new.value}. Permitidas: {allowed}.",
        )

    cost = ticket.estimated_cost
    if data.estimated_cost is not None:
        if new not in COST_EDITABLE_STATUSES:
            raise AppError(
                422, "estimated_cost solo puede definirse al pasar a DIAGNOSING o WAITING_APPROVAL."
            )
        cost = data.estimated_cost
    if new == TicketStatus.WAITING_APPROVAL and cost is None:
        raise AppError(422, "Debes indicar estimated_cost para pedir la aprobación del cliente.")

    ticket.status = new
    ticket.estimated_cost = cost
    db.add(
        TicketUpdate(
            ticket_id=ticket.id,
            author=actor,
            previous_status=previous,
            new_status=new,
            message=data.message or f"Estado actualizado: {previous.value} → {new.value}",
        )
    )
    await db.commit()
    return await _reload_detail(db, ticket_id)


async def approve(db: AsyncSession, *, ticket_id: int, actor: User) -> Ticket:
    ticket = await _get_for_update(db, ticket_id)
    if ticket is None or (ticket.user_id != actor.id and not actor.is_staff):
        raise AppError(404, NOT_FOUND)
    if ticket.user_id != actor.id:
        raise AppError(403, "Solo el cliente dueño del ticket puede aprobar el presupuesto.")
    if ticket.status != TicketStatus.WAITING_APPROVAL:
        raise AppError(
            409,
            f"El ticket no está esperando aprobación (estado actual: {ticket.status.value}).",
        )

    ticket.status = TicketStatus.APPROVED
    db.add(
        TicketUpdate(
            ticket_id=ticket.id,
            author=actor,
            previous_status=TicketStatus.WAITING_APPROVAL,
            new_status=TicketStatus.APPROVED,
            message="Presupuesto aprobado por el cliente",
        )
    )
    await db.commit()
    return await _reload_detail(db, ticket_id)


async def add_comment(
    db: AsyncSession, *, ticket: Ticket, author: User, content: str
) -> TicketComment:
    comment = TicketComment(ticket_id=ticket.id, author=author, content=content)
    ticket.updated_at = utcnow()  # la actividad reciente sube el ticket en el listado
    db.add(comment)
    await db.commit()
    return comment
