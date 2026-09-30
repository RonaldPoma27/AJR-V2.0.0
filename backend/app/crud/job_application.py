from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.pagination import list_with_counts
from app.models import ApplicationStatus, JobApplication
from app.models.base import utcnow


async def create(db: AsyncSession, data: dict[str, Any]) -> JobApplication:
    application = JobApplication(**data, consent_at=utcnow())
    db.add(application)
    await db.commit()
    return application


async def get(db: AsyncSession, application_id: int) -> JobApplication | None:
    return await db.get(JobApplication, application_id)


async def list_applications(
    db: AsyncSession, *, status: ApplicationStatus | None, skip: int, limit: int
) -> dict[str, Any]:
    return await list_with_counts(
        db, JobApplication, ApplicationStatus, status=status, skip=skip, limit=limit
    )


async def set_status(
    db: AsyncSession, application: JobApplication, status: ApplicationStatus
) -> JobApplication:
    application.status = status
    await db.commit()
    return application
