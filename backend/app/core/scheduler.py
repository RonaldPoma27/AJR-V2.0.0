"""Tareas periódicas: outbox de correo transaccional y limpieza de papelera.

El outbox usa bloqueos de fila SKIP LOCKED para coordinar varias instancias PostgreSQL.
La limpieza es idempotente y puede ejecutarse desde cada proceso.
"""
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.crud import trash as crud_trash
from app.crud import backup_email as crud_backup
from app.core.outbox import deliver_email_outbox_job

logger = logging.getLogger("scheduler")

PURGE_JOB_ID = "purge_trash"

scheduler = AsyncIOScheduler(timezone="UTC")


async def purge_trash_job() -> None:
    """Un error acá no debe tirar abajo el scheduler: se loguea y se reintenta en el próximo ciclo."""
    try:
        async with AsyncSessionLocal() as db:
            removed = await crud_trash.purge_expired(db)
            await crud_backup.purge(db)
        if removed:
            logger.info("Papelera: se eliminaron definitivamente %s elemento(s) vencido(s).", removed)
    except Exception:  # noqa: BLE001
        logger.exception("Falló la limpieza automática de la papelera.")


def start_scheduler() -> None:
    if not settings.SCHEDULER_ENABLED:
        logger.info("SCHEDULER_ENABLED=false: no se inician las tareas periódicas.")
        return
    scheduler.add_job(
        deliver_email_outbox_job,
        IntervalTrigger(minutes=1),
        id="deliver_email_outbox",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=35),
    )
    scheduler.add_job(
        purge_trash_job,
        IntervalTrigger(minutes=settings.TRASH_PURGE_INTERVAL_MINUTES),
        id=PURGE_JOB_ID,
        replace_existing=True,
        max_instances=1,  # nunca dos limpiezas a la vez
        coalesce=True,  # si se atrasó, corre una sola vez
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30),  # una pasada al arrancar
    )
    scheduler.start()
    logger.info(
        "Scheduler iniciado: outbox de correo cada 1 min; papelera cada %s min (retención %s días).",
        settings.TRASH_PURGE_INTERVAL_MINUTES,
        settings.TRASH_RETENTION_DAYS,
    )


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
