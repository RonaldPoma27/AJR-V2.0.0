"""Administración autenticada del correo de respaldo de la propia cuenta."""
from fastapi import APIRouter, Request
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DBSession
from app.core.exceptions import AppError
from app.core.rate_limit import client_ip
from app.schemas.backup_email import (
    BackupEmailReauthenticate,
    BackupEmailRequest,
    BackupEmailState,
    BackupEmailVerify,
)
from app.services import backup_email as service

router = APIRouter(prefix="/security", tags=["security"])


@router.get("/backup-email", response_model=BackupEmailState)
async def get_backup_email_status(db: DBSession, current_user: CurrentUser) -> BackupEmailState:
    """Devuelve únicamente el estado de correo de respaldo de la sesión actual."""
    return await service.read_state(db, current_user.id)


@router.post("/backup-email/request", response_model=BackupEmailState)
async def request_backup_email(
    payload: BackupEmailRequest,
    request: Request,
    db: DBSession,
    current_user: CurrentUser,
) -> BackupEmailState:
    """Solicita alta/cambio y envía el código antes de confirmar la transacción."""
    try:
        return await service.request_backup_email(
            db,
            user_id=current_user.id,
            target_email=str(payload.email),
            current_password=payload.current_password,
            request_ip=client_ip(request),
            method=request.method,
            path=request.url.path,
        )
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "Ese correo ya no está disponible. Probá con otra dirección.") from None


@router.post("/backup-email/verify", response_model=BackupEmailState)
async def verify_backup_email(
    payload: BackupEmailVerify,
    request: Request,
    db: DBSession,
    current_user: CurrentUser,
) -> BackupEmailState:
    try:
        return await service.verify_backup_email_code(
            db,
            user_id=current_user.id,
            code=payload.code,
            request_ip=client_ip(request),
            method=request.method,
            path=request.url.path,
        )
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "No se pudo verificar ese correo porque dejó de estar disponible.") from None


@router.post("/backup-email/resend", response_model=BackupEmailState)
async def resend_backup_email(
    payload: BackupEmailReauthenticate,
    request: Request,
    db: DBSession,
    current_user: CurrentUser,
) -> BackupEmailState:
    try:
        return await service.resend_backup_email_code(
            db,
            user_id=current_user.id,
            current_password=payload.current_password,
            request_ip=client_ip(request),
            method=request.method,
            path=request.url.path,
        )
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "No se pudo actualizar el desafío. Probá de nuevo.") from None


@router.delete("/backup-email", response_model=BackupEmailState)
async def delete_backup_email(
    payload: BackupEmailReauthenticate,
    request: Request,
    db: DBSession,
    current_user: CurrentUser,
) -> BackupEmailState:
    try:
        return await service.delete_backup_email(
            db,
            user_id=current_user.id,
            current_password=payload.current_password,
            request_ip=client_ip(request),
            method=request.method,
            path=request.url.path,
        )
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "No se pudo eliminar el correo de respaldo. Actualizá la pantalla e intentá de nuevo.") from None
