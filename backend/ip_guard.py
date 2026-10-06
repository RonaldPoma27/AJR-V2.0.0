"""Protección por IP: bloqueo por logins fallidos y baneo por exceso de pedidos.

- Login: LOGIN_MAX_FAILURES (5) contraseñas incorrectas desde una IP -> esa IP no puede
  iniciar sesión ni registrarse durante LOGIN_LOCK_MINUTES (30). Un login correcto borra el conteo.
- Flood: FLOOD_MAX_REQUESTS (60) o más pedidos a /api en FLOOD_WINDOW_SECONDS (60) -> la IP queda
  baneada de toda la API durante FLOOD_BAN_HOURS (12).

Los contadores viven en memoria (igual que app/core/rate_limit.py: un solo proceso). Los
bloqueos, en cambio, se guardan en la tabla `ip_blocks` y se recargan al arrancar, así que un
reinicio del servidor no libera a nadie. Con varias instancias habría que mover los
contadores a Redis.
"""
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select, update
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.audit import log_event
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.audit import IpBlock

logger = logging.getLogger("ip_guard")

LOGIN_LOCK = "login_lock"
FLOOD_BAN = "flood_ban"
_MAX_TRACKED_IPS = 20_000
_EXEMPT_PATHS = {"/api/health"}


@dataclass(frozen=True)
class Block:
    ip: str
    kind: str
    until: float  # epoch (segundos)
    reason: str

    @property
    def retry_after(self) -> int:
        return max(1, int(self.until - time.time()))


class IpGuard:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fails: dict[str, deque[float]] = {}
        self._hits: dict[str, deque[float]] = {}
        self._blocks: dict[str, Block] = {}  # una por IP: manda la más larga

    # ---------------------------------------------------------------- consultas
    def is_exempt(self, ip: str) -> bool:
        return not settings.IP_GUARD_ENABLED or ip in settings.trusted_ips

    def active_block(self, ip: str, kind: str | None = None) -> Block | None:
        if self.is_exempt(ip):
            return None
        with self._lock:
            block = self._blocks.get(ip)
            if block is None:
                return None
            if block.until <= time.time():
                del self._blocks[ip]
                return None
            return block if kind is None or block.kind == kind else None

    def list_active(self) -> list[Block]:
        now = time.time()
        with self._lock:
            for ip in [ip for ip, b in self._blocks.items() if b.until <= now]:
                del self._blocks[ip]
            return sorted(self._blocks.values(), key=lambda b: b.until, reverse=True)

    # ---------------------------------------------------------------- contadores
    async def register_request(self, ip: str) -> Block | None:
        """Cuenta un pedido a la API. Devuelve el baneo si con este se llegó al límite."""
        if self.is_exempt(ip):
            return None
        now = time.monotonic()
        window = settings.FLOOD_WINDOW_SECONDS
        with self._lock:
            hits = self._hits.setdefault(ip, deque())
            while hits and now - hits[0] > window:
                hits.popleft()
            hits.append(now)
            exceeded = len(hits) >= settings.FLOOD_MAX_REQUESTS
            if exceeded:
                hits.clear()
            if len(self._hits) > _MAX_TRACKED_IPS:
                self._purge(self._hits, now, window)
        if not exceeded:
            return None
        return await self._block(
            ip,
            FLOOD_BAN,
            seconds=settings.FLOOD_BAN_HOURS * 3600,
            reason=f"{settings.FLOOD_MAX_REQUESTS}+ pedidos en {window} s",
            action="ip_banned",
        )

    async def register_login_failure(self, ip: str) -> Block | None:
        """Cuenta una contraseña incorrecta. Devuelve el bloqueo si fue la que llegó al límite."""
        if self.is_exempt(ip):
            return None
        now = time.monotonic()
        window = settings.LOGIN_LOCK_MINUTES * 60
        with self._lock:
            fails = self._fails.setdefault(ip, deque())
            while fails and now - fails[0] > window:
                fails.popleft()
            fails.append(now)
            exceeded = len(fails) >= settings.LOGIN_MAX_FAILURES
            if exceeded:
                fails.clear()
            if len(self._fails) > _MAX_TRACKED_IPS:
                self._purge(self._fails, now, window)
        if not exceeded:
            return None
        return await self._block(
            ip,
            LOGIN_LOCK,
            seconds=settings.LOGIN_LOCK_MINUTES * 60,
            reason=f"{settings.LOGIN_MAX_FAILURES} intentos de login fallidos",
            action="ip_locked",
        )

    def clear_login_failures(self, ip: str) -> None:
        with self._lock:
            self._fails.pop(ip, None)

    @staticmethod
    def _purge(store: dict[str, deque[float]], now: float, window: float) -> None:
        for key in [k for k, v in store.items() if not v or now - v[-1] > window]:
            del store[key]

    # ---------------------------------------------------------------- bloqueos
    async def _block(self, ip: str, kind: str, *, seconds: int, reason: str, action: str) -> Block:
        block = Block(ip=ip, kind=kind, until=time.time() + seconds, reason=reason)
        with self._lock:
            current = self._blocks.get(ip)
            if current is None or current.until < block.until:
                self._blocks[ip] = block
        logger.warning("IP %s: %s (%s) por %d s", ip, action, reason, seconds)
        try:
            async with AsyncSessionLocal() as session:
                session.add(
                    IpBlock(
                        ip=ip,
                        kind=kind,
                        reason=reason,
                        blocked_until=datetime.fromtimestamp(block.until, tz=timezone.utc),
                    )
                )
                await session.commit()
        except Exception:  # noqa: BLE001 — el bloqueo en memoria ya rige igual
            logger.exception("No se pudo guardar el bloqueo de %s", ip)
        await log_event(action, ip=ip, entity="ip", entity_id=ip, entity_label=ip, detail=reason)
        return block

    async def load_active(self) -> None:
        """Recarga los bloqueos vigentes de la base (al arrancar)."""
        try:
            async with AsyncSessionLocal() as session:
                rows = await session.scalars(
                    select(IpBlock).where(
                        IpBlock.blocked_until > datetime.now(timezone.utc),
                        IpBlock.released_at.is_(None),
                    )
                )
                with self._lock:
                    for row in rows:
                        until = row.blocked_until.timestamp()
                        current = self._blocks.get(row.ip)
                        if current is None or current.until < until:
                            self._blocks[row.ip] = Block(row.ip, row.kind, until, row.reason or "")
            logger.info("Bloqueos de IP vigentes cargados: %d", len(self._blocks))
        except Exception:  # noqa: BLE001
            logger.exception("No se pudieron cargar los bloqueos de IP")

    async def release(self, ip: str, released_by: int | None = None) -> bool:
        """Levanta el bloqueo de una IP (y limpia sus contadores). True si había uno vigente."""
        with self._lock:
            existed = self._blocks.pop(ip, None) is not None
            self._fails.pop(ip, None)
            self._hits.pop(ip, None)
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(IpBlock)
                .where(IpBlock.ip == ip, IpBlock.released_at.is_(None))
                .values(released_at=datetime.now(timezone.utc), released_by=released_by)
            )
            await session.commit()
        return existed

    def reset(self) -> None:  # para tests
        with self._lock:
            self._fails.clear()
            self._hits.clear()
            self._blocks.clear()


guard = IpGuard()


def _human(seconds: int) -> str:
    hours, rest = divmod(seconds, 3600)
    minutes = -(-rest // 60)
    if hours:
        return f"{hours} h" + (f" {minutes} min" if minutes else "")
    return f"{minutes} min"


def block_message(block: Block) -> str:
    if block.kind == FLOOD_BAN:
        return f"Tu IP fue bloqueada por actividad sospechosa. Volvé a intentar en {_human(block.retry_after)}."
    return f"Demasiados intentos fallidos. Tu IP está bloqueada: probá de nuevo en {_human(block.retry_after)}."


class IpGuardMiddleware:
    """ASGI puro (más liviano que BaseHTTPMiddleware): corta a las IPs baneadas y cuenta pedidos."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if (
            scope["type"] != "http"
            or not path.startswith("/api")
            or path in _EXEMPT_PATHS
            or scope.get("method") == "OPTIONS"
        ):
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        ip = client[0] if client else "desconocida"

        block = guard.active_block(ip, FLOOD_BAN) or await guard.register_request(ip)
        if block is not None and block.kind == FLOOD_BAN:
            from starlette.responses import JSONResponse

            response = JSONResponse(
                status_code=429,
                content={"detail": block_message(block), "code": "ip_banned", "retry_after": block.retry_after},
                headers={"Retry-After": str(block.retry_after)},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
