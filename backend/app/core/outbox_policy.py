"""Política pura de reintentos para el outbox (sin dependencias de infraestructura)."""
from datetime import timedelta


def retry_delay(attempts: int) -> timedelta:
    """Backoff exponencial limitado a una hora (primer reintento: dos minutos)."""
    minutes = min(2 ** max(1, min(attempts, 6)), 60)
    return timedelta(minutes=minutes)
