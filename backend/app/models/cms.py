from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin
from app.models.enums import MediaType, ProjectStatus, value_enum


class CMSBase(CreatedAtMixin, Base):
    """Campos comunes del contenido de la landing (no genera tabla propia)."""

    __abstract__ = True

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))


class Service(CMSBase):
    __tablename__ = "services"

    description: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))


class PortfolioMedia(CreatedAtMixin, Base):
    """Un archivo de la galería de un proyecto del portfolio.

    Solo guarda URLs: hoy pueden ser links externos y cuando exista la cuenta de Cloudinary
    se guarda ahí la `secure_url` (y el `public_id`, que sirve para borrar el archivo allá).
    """

    __tablename__ = "portfolio_media"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(
        ForeignKey("portfolio_items.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(String(1000))
    media_type: Mapped[MediaType] = mapped_column(
        value_enum(MediaType, "media_type"),
        default=MediaType.IMAGE,
        server_default=MediaType.IMAGE.value,
    )
    caption: Mapped[str | None] = mapped_column(String(300))
    public_id: Mapped[str | None] = mapped_column(String(300))  # id en Cloudinary (a futuro)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class PortfolioItem(CMSBase):
    """Trabajo hecho o proyecto en progreso, con su galería multimedia."""

    __tablename__ = "portfolio_items"

    description: Mapped[str] = mapped_column(Text)
    status: Mapped[ProjectStatus] = mapped_column(
        value_enum(ProjectStatus, "project_status"),
        default=ProjectStatus.EN_PROGRESO,
        server_default=ProjectStatus.EN_PROGRESO.value,
    )
    client_name: Mapped[str | None] = mapped_column(String(200))
    project_url: Mapped[str | None] = mapped_column(String(500))

    # selectin: en async no existe el lazy-load, así la galería viaja siempre con el item.
    media: Mapped[list[PortfolioMedia]] = relationship(
        order_by="(PortfolioMedia.position, PortfolioMedia.id)",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )


class BlogPost(CMSBase):
    __tablename__ = "blog_posts"

    content: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
