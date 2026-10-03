import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash de relleno: se verifica cuando el email no existe para que login tarde lo mismo
# exista o no el usuario (evita enumerar cuentas por tiempo de respuesta).
DUMMY_PASSWORD_HASH = pwd_context.hash("not-a-real-password")


async def hash_password(password: str) -> str:
    # bcrypt es CPU-bound: se manda a un thread para no bloquear el event loop.
    return await asyncio.to_thread(pwd_context.hash, password)


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    return await asyncio.to_thread(pwd_context.verify, plain_password, hashed_password)


def create_access_token(subject: str | int, expires_delta: timedelta | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": str(subject), "iat": now, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Lanza jwt.PyJWTError si el token es inválido, expiró o le faltan claims."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "sub"]},
    )
