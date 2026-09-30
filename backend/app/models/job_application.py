from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import ApplicationStatus, value_enum


class JobApplication(TimestampMixin, Base):
    """Postulación enviada desde "Trabajá con nosotros"."""

    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(50))
    location: Mapped[str] = mapped_column(String(150))  # "Ciudad, País"
    area: Mapped[str] = mapped_column(String(60))
    experience_level: Mapped[str | None] = mapped_column(String(30))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    github_url: Mapped[str | None] = mapped_column(String(500))
    cv_url: Mapped[str | None] = mapped_column(String(500))
    # Preparado para una futura subida de archivos (hoy el disco de Render es efímero):
    # cv_file_url: Mapped[str | None] = mapped_column(String(500))
    motivation: Mapped[str] = mapped_column(Text)
    availability: Mapped[str | None] = mapped_column(String(30))
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[ApplicationStatus] = mapped_column(
        value_enum(ApplicationStatus, "application_status"),
        default=ApplicationStatus.NUEVA,
        server_default=ApplicationStatus.NUEVA.value,
        index=True,
    )
