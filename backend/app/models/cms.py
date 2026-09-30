from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin
from app.models.enums import ProjectStatus, value_enum


class CMSBase(CreatedAtMixin, Base):
    """Campos comunes del contenido de la landing (no genera tabla propia)."""

    __abstract__ = True

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    image_url: Mapped[str | None] = mapped_column(String(500))


class Service(CMSBase):
    __tablename__ = "services"

    description: Mapped[str] = mapped_column(Text)


class PortfolioItem(CMSBase):
    """Trabajo hecho o proyecto en progreso (en la v1 se llamaba `Project`)."""

    __tablename__ = "portfolio_items"

    description: Mapped[str] = mapped_column(Text)
    status: Mapped[ProjectStatus] = mapped_column(
        value_enum(ProjectStatus, "project_status"),
        default=ProjectStatus.EN_PROGRESO,
        server_default=ProjectStatus.EN_PROGRESO.value,
    )
    client_name: Mapped[str | None] = mapped_column(String(200))
    project_url: Mapped[str | None] = mapped_column(String(500))


class BlogPost(CMSBase):
    __tablename__ = "blog_posts"

    content: Mapped[str] = mapped_column(Text)
