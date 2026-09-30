from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request

from app.api.deps import AdminUser, DBSession
from app.core.email import send_order_emails
from app.core.exceptions import AppError
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.turnstile import verify_turnstile
from app.crud import client_order as crud_order
from app.models import OrderStatus
from app.schemas.client_order import ClientOrderCreate, ClientOrderRead, ClientOrderUpdate
from app.schemas.common import Page, Receipt

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=Receipt, status_code=201)
async def create_order(
    payload: ClientOrderCreate, request: Request, background: BackgroundTasks, db: DBSession
):
    """Público: recibe un pedido del formulario de contacto.

    Orden de defensas: rate limit por IP → honeypot (rechazo silencioso) → Turnstile.
    Los mails se mandan en segundo plano: no demoran la respuesta.
    """
    enforce_rate_limit(request, "orders")
    if payload.website:  # honeypot lleno = bot: fingimos éxito y no guardamos nada
        return Receipt()
    await verify_turnstile(payload.turnstile_token, client_ip(request))

    data = payload.model_dump(exclude={"turnstile_token", "website"})
    order = await crud_order.create(db, data)
    background.add_task(send_order_emails, {**data, "id": order.id})
    return Receipt()


@router.get("", response_model=Page[ClientOrderRead])
async def list_orders(
    db: DBSession,
    _: AdminUser,
    status_filter: Annotated[OrderStatus | None, Query(alias="status")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Solo ADMIN. Más recientes primero, con `total` y `counts` por estado."""
    return await crud_order.list_orders(db, status=status_filter, skip=skip, limit=limit)


@router.patch("/{order_id}", response_model=ClientOrderRead)
async def update_order(order_id: int, payload: ClientOrderUpdate, db: DBSession, _: AdminUser):
    order = await crud_order.get(db, order_id)
    if order is None:
        raise AppError(404, "Pedido no encontrado")
    return await crud_order.set_status(db, order, payload.status)
