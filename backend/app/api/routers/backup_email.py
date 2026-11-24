from fastapi import APIRouter, Request
from app.api.deps import CurrentUser, DBSession
from app.schemas.backup_email import (BackupEmailState, BackupEmailRequest, BackupEmailVerify,
                                    BackupEmailResend, BackupEmailDelete)
from app.services import backup_email as service

router = APIRouter(prefix="/security/backup-email", tags=["account-security"], responses={
    400: {"description": "Invalid or expired verification code"},
    401: {"description": "Authentication required"},
    403: {"description": "Current password incorrect"},
    409: {"description": "Address unavailable or no pending challenge"},
    422: {"description": "Invalid input (sensitive values are omitted)"},
    429: {"description": "Persistent quota, cooldown or attempt limit reached"},
    503: {"description": "SMTP unavailable; previous state preserved"},
})


def peer(request: Request):
    # Do not parse client-controlled forwarding headers. Configure trusted proxies in Uvicorn.
    return request.client.host if request.client else "unknown"


@router.get("", response_model=BackupEmailState)
async def read(db: DBSession, user: CurrentUser):
    await service.crud.lock_user(db, user.id)
    return await service.state(db, user.id)


@router.post("/request", response_model=BackupEmailState)
async def request_code(payload: BackupEmailRequest, request: Request, db: DBSession, user: CurrentUser):
    return await service.request_code(db, user.id, peer(request), payload)


@router.post("/verify", response_model=BackupEmailState)
async def verify(payload: BackupEmailVerify, request: Request, db: DBSession, user: CurrentUser):
    return await service.verify(db, user.id, peer(request), payload)


@router.post("/resend", response_model=BackupEmailState)
async def resend(payload: BackupEmailResend, request: Request, db: DBSession, user: CurrentUser):
    return await service.request_code(db, user.id, peer(request), payload, resend=True)


@router.delete("", response_model=BackupEmailState)
async def remove(payload: BackupEmailDelete, request: Request, db: DBSession, user: CurrentUser):
    return await service.remove(db, user.id, peer(request), payload)
