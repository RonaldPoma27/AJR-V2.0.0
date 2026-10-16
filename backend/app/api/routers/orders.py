from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response

from app.api.deps import AdminUser, CurrentUser, DBSession, StaffUser
from app.core.email import send_order_emails, send_order_status_email
from app.core.exceptions import AppError
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.turnstile import verify_turnstile
from app.crud import client_order as crud_order
from app.crud import trash as crud_trash
from app.crud import user as crud_user
from app.models import OrderStatus
from app.schemas.client_order import ClientOrderCreate, ClientOrderRead, ClientOrderUpdate
from app.schemas.common import Page, Receipt

router = APIRouter(prefix="/orders", tags=["orders"])

NOT_FOUND = "Pedido no encontrado"


@router.post("", response_model=Receipt, status_code=201)
async def create_order(
    payload: ClientOrderCreate,
    request: Request,
    background: BackgroundTasks,
    db: DBSession,
    current_user: CurrentUser,
):
    """Requiere sesión: el pedido queda asociado al cliente (`user_id` sale del token).

    Orden de defensas: login → rate limit por IP → honeypot (rechazo silencioso) → Turnstile.
    Los mails se mandan en segundo plano: no demoran la respuesta.
    """
    enforce_rate_limit(request, "orders")
    if payload.website:  # honeypot lleno = bot: fingimos éxito y no guardamos nada
        return Receipt()
    await verify_turnstile(payload.turnstile_token, client_ip(request))

    data = payload.model_dump(exclude={"turnstile_token", "website"})
    order = await crud_order.create(db, data, user_id=current_user.id)
    background.add_task(send_order_emails, {**data, "id": order.id})
    return Receipt()


@router.get("/mine", response_model=list[ClientOrderRead])
async def list_my_orders(db: DBSession, current_user: CurrentUser):
    """\"Mis pedidos\": solo los del usuario logueado, más recientes primero."""
    return await crud_order.list_for_user(db, current_user.id)


@router.get("", response_model=Page[ClientOrderRead])
async def list_orders(
    db: DBSession,
    _: StaffUser,
    status_filter: Annotated[OrderStatus | None, Query(alias="status")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """TECHNICIAN y ADMIN. Más recientes primero, con `total` y `counts` por estado.
    No incluye lo que está en la papelera."""
    return await crud_order.list_orders(db, status=status_filter, skip=skip, limit=limit)


@router.patch("/{order_id}", response_model=ClientOrderRead)
async def update_order(
    order_id: int,
    payload: ClientOrderUpdate,
    background: BackgroundTasks,
    db: DBSession,
    _: StaffUser,
):
    """TECHNICIAN y ADMIN cambian el estado. Si cambió de verdad, se avisa por mail al dueño."""
    order = await crud_order.get(db, order_id)
    if order is None:
        raise AppError(404, NOT_FOUND)

    previous = order.status
    order = await crud_order.set_status(db, order, payload.status)

    if order.status != previous:
        owner = await crud_user.get(db, order.user_id) if order.user_id else None
        # Pedidos anteriores a la v2.1 no tienen dueño: se avisa al email del formulario.
        background.add_task(
            send_order_status_email,
            to=owner.email if owner else order.contact_email,
            name=(owner.first_name if owner and owner.first_name else order.contact_name),
            order_id=order.id,
            company_name=order.company_name,
            status=order.status.value,
        )
    return order


@router.delete("/{order_id}", status_code=204)
async def trash_order(order_id: int, db: DBSession, _: AdminUser):
    """Solo ADMIN: envía el pedido a la papelera (borrado lógico, 30 días para restaurarlo)."""
    order = await crud_order.get(db, order_id)
    if order is None:
        raise AppError(404, NOT_FOUND)
    await crud_trash.soft_delete(db, order)
    return Response(status_code=204)
