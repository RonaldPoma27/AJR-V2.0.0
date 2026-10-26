"""Validación de Cloudflare Turnstile en el backend."""
import logging

import httpx

from app.core.config import settings
from app.core.exceptions import AppError

logger = logging.getLogger("turnstile")

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str | None, ip: str | None = None) -> None:
    """Lanza AppError si el token no es válido.

    - Sin TURNSTILE_SECRET_KEY: en desarrollo se saltea (con aviso); en producción
      falla cerrado, para no dejar los formularios abiertos por un error de configuración.
    """
    if not settings.TURNSTILE_SECRET_KEY:
        if settings.is_production:
            logger.error("TURNSTILE_SECRET_KEY no está configurada en producción.")
            raise AppError(503, "El envío de formularios no está disponible por el momento.")
        logger.warning("Turnstile deshabilitado (sin TURNSTILE_SECRET_KEY): solo válido en desarrollo.")
        return

    if not token:
        raise AppError(400, "Completá la verificación anti-spam antes de enviar.")

    data = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token}
    if ip and ip != "desconocida":
        data["remoteip"] = ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(VERIFY_URL, data=data)
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError):
        logger.exception("No se pudo consultar a Cloudflare Turnstile.")
        raise AppError(503, "No pudimos verificar el anti-spam. Probá de nuevo en unos minutos.") from None

    if not result.get("success"):
        logger.info("Turnstile rechazó el token: %s", result.get("error-codes"))
        raise AppError(400, "No pudimos verificar que sos una persona. Recargá la página y probá de nuevo.")
