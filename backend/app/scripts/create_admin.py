"""Crea el usuario ADMIN inicial.

    python -m app.scripts.create_admin

Lee ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_FULL_NAME (alias legacy: FIRST_ADMIN_EMAIL y
FIRST_ADMIN_PASSWORD). Es idempotente: si el email ya existe no lo toca. Si faltan email o
contraseña, lo saltea sin fallar. Nunca imprime la contraseña.
"""
import asyncio
import logging

from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.crud import user as crud_user
from app.models import UserRole

logger = logging.getLogger("create_admin")


async def create_admin() -> None:
    email = (settings.ADMIN_EMAIL or "").strip().lower()
    password = settings.ADMIN_PASSWORD or ""

    if not email or not password:
        logger.info("ADMIN_EMAIL/ADMIN_PASSWORD no definidos: no se crea ningún admin.")
        return
    if "@" not in email:
        logger.warning("ADMIN_EMAIL no parece un email válido: no se crea el admin.")
        return
    if len(password) < 8 or len(password.encode("utf-8")) > 72:
        logger.warning("ADMIN_PASSWORD debe tener entre 8 y 72 bytes: no se crea el admin.")
        return

    async with AsyncSessionLocal() as session:
        existing = await crud_user.get_by_email(session, email)
        if existing is not None:
            if existing.role != UserRole.ADMIN:
                logger.warning("%s ya existe con rol %s; no se modifica.", email, existing.role.value)
            else:
                logger.info("El admin %s ya existe: nada que hacer.", email)
            return
        try:
            await crud_user.create(
                session,
                email=email,
                password=password,
                role=UserRole.ADMIN,
                full_name=settings.ADMIN_FULL_NAME,
            )
        except IntegrityError:  # otra instancia lo creó en paralelo
            await session.rollback()
            logger.info("El admin %s ya fue creado por otro proceso.", email)
            return
        logger.info("Admin creado: %s", email)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[create_admin] %(levelname)s %(message)s")
    try:
        await create_admin()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
