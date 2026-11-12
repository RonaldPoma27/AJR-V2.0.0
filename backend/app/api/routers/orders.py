from datetime import datetime, timezone
import secrets
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response
from sqlalchemy import select

from app.api.deps import AdminUser, CurrentUser, DBSession, StaffUser
from app.core.email import send_order_emails, send_order_status_email
from app.core.exceptions import AppError
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.turnstile import verify_turnstile
from app.crud import client_order as crud_order
from app.crud import trash as crud_trash
from app.crud import user as crud_user
from app.models import AuditLog, ClientOrder, EmailOutbox, OrderStatus
from app.schemas.client_order import ClientOrderCreate, ClientOrderRead, ClientOrderUpdate
from app.schemas.order_regret import OrderRegretReceipt, OrderRegretRequest
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


@router.post("/regret", response_model=OrderRegretReceipt, status_code=202)
async def request_order_regret(
    payload: OrderRegretRequest,
    request: Request,
    db: DBSession,
):
    """Recibe una solicitud pública sin exigir cuenta o inicio de sesión.

    Número de pedido + email es una verificación acotada a identidad y seguridad. No se
    rechaza por `created_at`: la fecha de creación de una solicitud no prueba cuándo se
    celebró el contrato ni cuándo se entregó el bien. La elegibilidad se revisa con los
    antecedentes contractuales reales, sin bloquear la recepción por un dato técnico.
    """
    enforce_rate_limit(request, "order-regret")
    statement = (
        select(ClientOrder)
        .where(ClientOrder.id == payload.order_id, ClientOrder.deleted_at.is_(None))
        .with_for_update()
    )
    order = await db.scalar(statement)
    if order is None or order.contact_email.casefold() != str(payload.contact_email).casefold():
        # Respuesta genérica para no revelar si existe un pedido asociado a otro email.
        raise AppError(404, "No encontramos un pedido con esos datos.")

    if order.regret_requested_at and order.regret_code:
        return OrderRegretReceipt(
            request_code=order.regret_code,
            requested_at=order.regret_requested_at,
        )

    now = datetime.now(timezone.utc)
    request_code = f"AJR-AR-{secrets.token_hex(8).upper()}"
    order.regret_requested_at = now
    order.regret_code = request_code
    # La auditoría y el cambio del pedido comparten transacción: no se confirma
    # la solicitud si no queda también registrada su trazabilidad.
    db.add(
        AuditLog(
            user_id=order.user_id,
            user_email=order.contact_email[:255],
            user_role="USER" if order.user_id else None,
            action="regret_requested",
            entity="client_orders",
            entity_id=str(order.id),
            entity_label=f"Pedido #{order.id} · {order.company_name}",
            ip=client_ip(request),
            method="POST",
            path=request.url.path,
            detail=f"Solicitud recibida; código {request_code}.",
        )
    )
    db.add(
        EmailOutbox(
            dedupe_key=f"order-regret:{order.id}",
            event_type="order_regret_received",
            order_id=order.id,
            recipient=order.contact_email,
            payload={
                "name": order.contact_name,
                "order_id": order.id,
                "request_code": request_code,
            },
        )
    )
    # Solicitud, auditoría y correo pendiente se confirman o revierten juntos.
    await db.commit()
    return OrderRegretReceipt(request_code=request_code, requested_at=now)


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
