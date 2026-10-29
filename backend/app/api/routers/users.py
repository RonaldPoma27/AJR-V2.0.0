from fastapi import APIRouter, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DBSession
from app.core.exceptions import AppError
from app.core.security import verify_password
from app.crud import user as crud_user
from app.models.backup_email import BackupEmail
from app.services.backup_email import lock_backup_email_identity
from app.schemas.user import EmailChange, PasswordChange, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserRead)
async def update_me(payload: UserUpdate, db: DBSession, current_user: CurrentUser):
    """El usuario logueado edita su nombre y apellido."""
    return await crud_user.update_name(
        db, current_user, first_name=payload.first_name, last_name=payload.last_name
    )


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


@router.patch("/me/email", response_model=UserRead)
async def change_my_email(payload: EmailChange, db: DBSession, current_user: CurrentUser):
    """El usuario logueado cambia su email. Pide el actual y la contraseña como confirmación.

    Como en /me/password, los errores de credenciales son 400 (no 401) para que el frontend
    no los confunda con "sesión vencida". El JWT lleva el id del usuario, así que la sesión
    sigue válida después del cambio.
    """
    if payload.current_email != current_user.email.lower():
        raise AppError(400, "El email actual no coincide con el de tu cuenta")
    if payload.new_email == payload.current_email:
        raise AppError(400, "El email nuevo tiene que ser distinto del actual")
    # Reautenticar antes de consultar si el destino está reservado, para no permitir que una
    # sesión sin la contraseña actual use este endpoint para enumerar correos de respaldo.
    if not await verify_password(payload.current_password, current_user.hashed_password):
        raise AppError(400, "La contraseña no es correcta")
    # Serializa el cambio de correo principal con una solicitud de correo de respaldo al mismo
    # destino. Así no se puede convertir en principal una dirección reservada como respaldo.
    await lock_backup_email_identity(db, payload.new_email)
    backup_owner = await db.scalar(
        select(BackupEmail.id)
        .where(BackupEmail.email == payload.new_email, BackupEmail.status == "VERIFIED")
        .limit(1)
    )
    if backup_owner is not None:
        raise AppError(409, "Ese email ya está configurado como correo de respaldo y no puede ser principal.")
    if await crud_user.get_by_email(db, payload.new_email) is not None:
        raise AppError(409, "El email ya está registrado")
    try:
        user = await crud_user.change_email(
            db, current_user, current_password=payload.current_password, new_email=payload.new_email
        )
    except IntegrityError:  # carrera: otro registro tomó el email en el medio
        await db.rollback()
        raise AppError(409, "El email ya está registrado")
    if user is None:
        raise AppError(400, "La contraseña no es correcta")
    return user
