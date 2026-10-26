from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import client_ip
from app.core.security import decode_access_token
from app.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    request: Request, token: Annotated[str, Depends(oauth2_scheme)], db: DBSession
) -> User:
    """Extrae el ID del token y busca al usuario. El rol se lee siempre de la DB."""
    credentials_error = HTTPException(
        status_code=401,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise credentials_error from None

    user = await db.get(User, user_id)
    if user is None:
        raise credentials_error
    if user.is_staff:
        # Auditoría (app/core/audit.py): todo cambio que haga el equipo en esta sesión queda
        # registrado con quién, desde qué IP y en qué endpoint.
        db.sync_session.info["audit_ctx"] = {
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
            "ip": client_ip(request),
            "method": request.method,
            "path": request.url.path,
        }
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_technician_or_admin(current_user: CurrentUser) -> User:
    if current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Requiere rol TECHNICIAN o ADMIN")
    return current_user


async def require_admin(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Requiere rol ADMIN")
    return current_user


StaffUser = Annotated[User, Depends(require_technician_or_admin)]
AdminUser = Annotated[User, Depends(require_admin)]
