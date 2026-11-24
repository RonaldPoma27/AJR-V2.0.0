"""Despacho durable de notificaciones transaccionales."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.email import send_order_regret_email
from app.models import EmailOutbox
from app.core.outbox_policy import retry_delay

logger = logging.getLogger("email_outbox")
BATCH_SIZE = 20


async def deliver_email_outbox_job() -> None:
    """Entrega hasta 20 mensajes vencidos; conserva la fila y reintenta ante fallas.

    La fila queda bloqueada con `FOR UPDATE SKIP LOCKED` durante el despacho para evitar
    que dos instancias envíen simultáneamente el mismo mensaje. Esto requiere PostgreSQL,
    que es la base de datos objetivo de este proyecto.
    """
    now = datetime.now(timezone.utc)
    try:
        async with AsyncSessionLocal() as db:
            statement = (
                select(EmailOutbox)
                .where(
                    EmailOutbox.status == "PENDING",
                    EmailOutbox.next_attempt_at <= now,
                )
                .order_by(EmailOutbox.created_at, EmailOutbox.id)
                .limit(BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )
            messages = list((await db.scalars(statement)).all())
            for message in messages:
                try:
                    if message.event_type != "order_regret_received":
                        raise ValueError(f"Tipo de evento de email no soportado: {message.event_type}")
                    payload = message.payload
                    await asyncio.to_thread(
                        send_order_regret_email,
                        to=message.recipient,
                        name=str(payload["name"]),
                        order_id=int(payload["order_id"]),
                        request_code=str(payload["request_code"]),
                        strict=True,
                    )
                    message.status = "SENT"
                    message.sent_at = datetime.now(timezone.utc)
                    message.last_error = None
                    logger.info("Outbox %s enviado tras %s intento(s).", message.id, message.attempts + 1)
                except Exception as exc:  # noqa: BLE001 - se conserva para reintentar
                    message.attempts += 1
                    message.next_attempt_at = datetime.now(timezone.utc) + retry_delay(message.attempts)
                    # No persistimos el contenido del error SMTP, que podría contener datos operativos.
                    message.last_error = type(exc).__name__[:120]
                    logger.exception(
                        "Falló el envío del outbox %s; nuevo intento programado para %s.",
                        message.id,
                        message.next_attempt_at.isoformat(),
                    )
            await db.commit()
            overdue = await db.scalar(
                select(EmailOutbox)
                .where(
                    EmailOutbox.status == "PENDING",
                    EmailOutbox.created_at <= now - timedelta(hours=24),
                    (EmailOutbox.last_alerted_at.is_(None))
                    | (EmailOutbox.last_alerted_at <= now - timedelta(hours=6)),
                )
                .order_by(EmailOutbox.created_at, EmailOutbox.id)
                .limit(1)
            )
            if overdue is not None:
                overdue.last_alerted_at = now
                logger.error(
                    "Hay notificaciones de email pendientes hace más de 24 horas; revisar SMTP y scheduler. "
                    "Outbox id=%s, creado=%s, intentos=%s.",
                    overdue.id,
                    overdue.created_at.isoformat(),
                    overdue.attempts,
                )
                await db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Falló el ciclo de despacho del outbox.")
