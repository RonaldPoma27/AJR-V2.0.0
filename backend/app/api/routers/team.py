from fastapi import APIRouter

from app.api.deps import AdminUser, DBSession, StaffUser
from app.core.exceptions import AppError
from app.crud import user as crud_user
from app.models import UserRole
from app.schemas.user import TechnicianPromote, UserRead

router = APIRouter(prefix="/team/technicians", tags=["team"])


@router.get("", response_model=list[UserRead])
async def list_technicians(db: DBSession, _: StaffUser):
    """TECHNICIAN y ADMIN pueden ver la lista; solo el ADMIN puede modificarla."""
    return await crud_user.list_by_role(db, UserRole.TECHNICIAN)


@router.post("", response_model=UserRead, status_code=201)
async def promote_to_technician(payload: TechnicianPromote, db: DBSession, _: AdminUser):
    """Solo ADMIN: promueve a un usuario ya registrado (por su email) a TECHNICIAN."""
    user = await crud_user.get_by_email(db, payload.email)
    if user is None:
        raise AppError(404, "No hay ningún usuario registrado con ese email.")
    if user.role == UserRole.ADMIN:
        raise AppError(409, "Esa cuenta es ADMIN: ya tiene todos los permisos.")
    if user.role == UserRole.TECHNICIAN:
        raise AppError(409, "Esa cuenta ya es TECHNICIAN.")
    return await crud_user.set_role(db, user, UserRole.TECHNICIAN)


@router.delete("/{user_id}", response_model=UserRead)
async def remove_technician(user_id: int, db: DBSession, _: AdminUser):
    """Solo ADMIN: le quita el rol (vuelve a USER). El rol se lee de la DB en cada request,
    así que el cambio rige de inmediato aunque la persona tenga una sesión abierta."""
    user = await crud_user.get(db, user_id)
    if user is None or user.role != UserRole.TECHNICIAN:
        raise AppError(404, "Esa cuenta no es TECHNICIAN.")
    return await crud_user.set_role(db, user, UserRole.USER)
