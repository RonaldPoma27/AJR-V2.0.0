"""Rate limit por IP en memoria (ventana deslizante).

Limitación conocida: el contador vive en el proceso, así que NO se comparte entre workers
ni sobrevive a un reinicio. Para un único contenedor en Render alcanza; si se escala a
varias instancias hay que pasar a Redis (o similar).
"""
import logging
import threading
import time
from collections import deque

from fastapi import Request

from app.core.config import settings
from app.core.exceptions import AppError

logger = logging.getLogger("rate_limit")

WINDOW_SECONDS = 60 * 60
_MAX_TRACKED_KEYS = 10_000


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window: float = WINDOW_SECONDS) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] > window:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            if len(self._hits) > _MAX_TRACKED_KEYS:
                self._purge(now, window)
            return True

    def _purge(self, now: float, window: float) -> None:
        for key in [k for k, v in self._hits.items() if not v or now - v[-1] > window]:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    # Con --proxy-headers uvicorn ya reemplaza client.host por la IP real (X-Forwarded-For).
    return request.client.host if request.client else "desconocida"


def enforce_rate_limit(request: Request, scope: str) -> None:
    """Lanza 429 si la IP superó RATE_LIMIT_PER_HOUR envíos en la última hora para `scope`."""
    ip = client_ip(request)
    if not limiter.allow(f"{scope}:{ip}", settings.RATE_LIMIT_PER_HOUR):
        logger.warning("Rate limit excedido: scope=%s ip=%s", scope, ip)
        raise AppError(429, "Enviaste demasiados formularios en poco tiempo. Probá de nuevo en un rato.")
