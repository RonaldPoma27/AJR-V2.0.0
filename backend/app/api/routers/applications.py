from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request

from app.api.deps import AdminUser, DBSession
from app.core.email import send_application_emails
from app.core.exceptions import AppError
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.turnstile import verify_turnstile
from app.crud import job_application as crud_application
from app.models import ApplicationStatus
from app.schemas.common import Page, Receipt
from app.schemas.job_application import (
    JobApplicationCreate,
    JobApplicationRead,
    JobApplicationUpdate,
)

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", response_model=Receipt, status_code=201)
async def create_application(
    payload: JobApplicationCreate, request: Request, background: BackgroundTasks, db: DBSession
):
    """Público: postulación desde "Trabajá con nosotros"."""
    enforce_rate_limit(request, "applications")
    if payload.website:  # honeypot
        return Receipt()
    await verify_turnstile(payload.turnstile_token, client_ip(request))

    data = payload.model_dump(exclude={"turnstile_token", "website"})
    application = await crud_application.create(db, data)
    background.add_task(send_application_emails, {**data, "id": application.id})
    return Receipt()


@router.get("", response_model=Page[JobApplicationRead])
async def list_applications(
    db: DBSession,
    _: AdminUser,
    status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Solo ADMIN (son datos personales de candidatos)."""
    return await crud_application.list_applications(db, status=status_filter, skip=skip, limit=limit)


@router.patch("/{application_id}", response_model=JobApplicationRead)
async def update_application(
    application_id: int, payload: JobApplicationUpdate, db: DBSession, _: AdminUser
):
    application = await crud_application.get(db, application_id)
    if application is None:
        raise AppError(404, "Postulación no encontrada")
    return await crud_application.set_status(db, application, payload.status)
