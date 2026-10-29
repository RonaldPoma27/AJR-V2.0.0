"""Tareas periódicas en segundo plano (APScheduler, dentro del mismo proceso de FastAPI).

Mantiene la limpieza periódica de la papelera y elimina desafíos de correo de respaldo que
superan la ventana de retención configurada. La tarea es idempotente entre instancias.

Nota de escala: el scheduler vive en el proceso. Con varias instancias/workers el job corre en
cada una; es seguro porque el DELETE es idempotente, solo se repite trabajo.
"""
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.crud import backup_email as crud_backup_email
from app.crud import trash as crud_trash
from app.models.base import utcnow

logger = logging.getLogger("scheduler")

PURGE_JOB_ID = "purge_trash"

scheduler = AsyncIOScheduler(timezone="UTC")


async def purge_trash_job() -> None:
    """Un error acá no debe tirar abajo el scheduler: se loguea y se reintenta en el próximo ciclo."""
    try:
        async with AsyncSessionLocal() as db:
            removed = await crud_trash.purge_expired(db)
            cutoff = utcnow() - timedelta(hours=settings.BACKUP_EMAIL_CHALLENGE_RETENTION_HOURS)
            removed_challenges = await crud_backup_email.purge_old_challenges(db, cutoff)
            await db.commit()
        if removed:
            logger.info("Papelera: se eliminaron definitivamente %s elemento(s) vencido(s).", removed)
        if removed_challenges:
            logger.info("Seguridad: se eliminaron %s desafío(s) de correo de respaldo vencido(s).", removed_challenges)
    except Exception:  # noqa: BLE001
        logger.exception("Falló la limpieza automática de la papelera.")


def start_scheduler() -> None:
    if not settings.SCHEDULER_ENABLED:
        logger.info("SCHEDULER_ENABLED=false: no se inician las tareas periódicas.")
        return
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
        "Scheduler iniciado: papelera cada %s min (retención %s días).",
        settings.TRASH_PURGE_INTERVAL_MINUTES,
        settings.TRASH_RETENTION_DAYS,
    )


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
