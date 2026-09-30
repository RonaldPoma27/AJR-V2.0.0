from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, DBSession
from app.core.exceptions import AppError
from app.crud import user as crud_user
from app.schemas.user import PasswordChange

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me/password", status_code=204)
async def change_my_password(payload: PasswordChange, db: DBSession, current_user: CurrentUser):
    """El usuario logueado cambia su propia contraseña.

    Ojo: si la actual está mal devolvemos 400 (no 401) a propósito: el frontend trata
    cualquier 401 como "sesión vencida" y te saca al login.
    """
    if payload.new_password == payload.current_password:
        raise AppError(400, "La contraseña nueva tiene que ser distinta de la actual")
    if not await crud_user.change_password(
        db,
        current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    ):
        raise AppError(400, "La contraseña actual no es correcta")
    return Response(status_code=204)
