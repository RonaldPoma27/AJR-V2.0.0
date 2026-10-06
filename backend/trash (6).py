from fastapi import APIRouter, Response

from app.api.deps import AdminUser, DBSession
from app.core.exceptions import AppError
from app.crud import trash as crud_trash
from app.crud.trash import Kind
from app.schemas.trash import TrashList

router = APIRouter(prefix="/trash", tags=["trash"])


@router.get("", response_model=TrashList)
async def list_trash(db: DBSession, _: AdminUser):
    """Solo ADMIN: lo descartado, con el tiempo que le queda antes de la eliminación definitiva."""
    return {
        "retention_days": crud_trash.retention().days,
        "items": await crud_trash.list_trash(db),
    }


@router.post("/{kind}/{item_id}/restore", status_code=204)
async def restore_item(kind: Kind, item_id: int, db: DBSession, _: AdminUser):
    """Solo ADMIN: saca un pedido o una postulación de la papelera."""
    obj = await crud_trash.get_any(db, kind, item_id)
    if obj is None or obj.deleted_at is None:
        raise AppError(404, "No está en la papelera")
    await crud_trash.restore(db, obj)
    return Response(status_code=204)
