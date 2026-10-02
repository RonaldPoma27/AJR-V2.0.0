from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DBSession
from app.core.rate_limit import enforce_rate_limit
from app.core.security import create_access_token
from app.crud import user as crud_user
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_TAKEN = "El email ya está registrado"


@router.post("/register", response_model=UserRead, status_code=201)
async def register(payload: UserCreate, request: Request, db: DBSession):
    """Registro público: siempre crea un usuario con rol USER (sin acceso al panel admin)."""
    enforce_rate_limit(request, "register")
    if await crud_user.get_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=409, detail=EMAIL_TAKEN)
    try:
        return await crud_user.create(
            db,
            email=payload.email,
            password=payload.password,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
    except IntegrityError:  # carrera entre dos registros simultáneos con el mismo email
        await db.rollback()
        raise HTTPException(status_code=409, detail=EMAIL_TAKEN) from None


@router.post("/login", response_model=Token)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DBSession):
    """Form-data estándar OAuth2: `username` (el email) y `password`."""
    user = await crud_user.authenticate(db, email=form.username, password=form.password)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserRead)
async def read_me(current_user: CurrentUser):
    return current_user
