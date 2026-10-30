from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DBSession
from app.core.audit import log_event
from app.core.ip_guard import LOGIN_LOCK, Block, block_message, guard
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.security import create_access_token
from app.core.turnstile import verify_turnstile
from app.crud import user as crud_user
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserRead, UserRegistered

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_TAKEN = "El email ya está registrado"


def _locked(block: Block) -> HTTPException:
    """429 con Retry-After y un `code` que el frontend traduce."""
    return HTTPException(
        status_code=429,
        detail=block_message(block),
        headers={"Retry-After": str(block.retry_after), "X-Block-Kind": block.kind},
    )


def _assert_not_locked(ip: str) -> None:
    block = guard.active_block(ip, LOGIN_LOCK)
    if block is not None:
        raise _locked(block)


@router.post("/register", response_model=UserRegistered, status_code=201)
async def register(payload: UserCreate, request: Request, db: DBSession):
    """Registro público: siempre crea un usuario con rol USER (sin acceso al panel admin)."""
    ip = client_ip(request)
    _assert_not_locked(ip)
    enforce_rate_limit(request, "register")
    await verify_turnstile(payload.turnstile_token, ip)
    if await crud_user.get_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=409, detail=EMAIL_TAKEN)
    try:
        user = await crud_user.create(
            db,
            email=payload.email,
            password=payload.password,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
    except IntegrityError:  # carrera entre dos registros simultáneos con el mismo email
        await db.rollback()
        raise HTTPException(status_code=409, detail=EMAIL_TAKEN) from None
    return UserRegistered(
        **UserRead.model_validate(user).model_dump(), access_token=create_access_token(user.id)
    )


@router.post("/login", response_model=Token)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    request: Request,
    db: DBSession,
    turnstile_token: Annotated[str | None, Form(max_length=4096)] = None,
):
    """Form-data estándar OAuth2: `username` (el email) y `password`, más `turnstile_token`.

    Defensas: IP bloqueada -> Turnstile -> credenciales. A la 5.ª contraseña incorrecta seguida
    la IP queda bloqueada 30 minutos (ver app/core/ip_guard.py).
    """
    ip = client_ip(request)
    _assert_not_locked(ip)
    await verify_turnstile(turnstile_token, ip)
    user = await crud_user.authenticate(db, email=form.username, password=form.password)
    if user is None:
        known = await crud_user.get_by_email(db, form.username)
        if known is not None and known.is_staff:
            await log_event(
                "login_failed", user_id=known.id, email=known.email, role=known.role.value,
                ip=ip, method="POST", path="/api/auth/login",
            )
        block = await guard.register_login_failure(ip)
        if block is not None:
            raise _locked(block)
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    guard.clear_login_failures(ip)
    if user.is_staff:
        await log_event(
            "login", user_id=user.id, email=user.email, role=user.role.value,
            ip=ip, method="POST", path="/api/auth/login",
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserRead)
async def read_me(current_user: CurrentUser):
    return current_user
