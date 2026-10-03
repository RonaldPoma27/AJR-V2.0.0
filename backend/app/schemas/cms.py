from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    model_validator,
)

from app.models.enums import MediaType, ProjectStatus
from app.schemas.common import OptionalUrl, _empty_to_none

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _validate_image_url(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) > 500:
        raise ValueError("image_url no puede superar los 500 caracteres")
    if not value.lower().startswith(("http://", "https://")):
        raise ValueError("image_url debe empezar con http:// o https://")
    return value


ImageUrl = Annotated[str | None, AfterValidator(_validate_image_url)]


def _validate_media_url(value: str) -> str:
    value = value.strip()
    if len(value) > 1000:
        raise ValueError("La URL no puede superar los 1000 caracteres")
    if not value.lower().startswith(("http://", "https://")) or " " in value:
        raise ValueError("La URL debe empezar con http:// o https:// y no tener espacios")
    return value


MediaUrl = Annotated[str, AfterValidator(_validate_media_url)]
ShortText = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None,
    BeforeValidator(_empty_to_none),
]


# PUT reemplaza el recurso completo, por eso usa el mismo schema que POST.
class _ContentCreate(BaseModel):
    title: Title
    description: Body
    image_url: ImageUrl = None


class ServiceCreate(_ContentCreate):
    pass


class BlogPostCreate(BaseModel):
    title: Title
    content: Body
    image_url: ImageUrl = None


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class ServiceRead(_ContentCreate, _Read):
    pass


class BlogPostRead(BlogPostCreate, _Read):
    pass


# ------------------------------------------------------------------ portfolio (galería)
MAX_GALLERY_ITEMS = 30


class PortfolioMediaIn(BaseModel):
    """Un archivo de la galería. Hoy es un link; con Cloudinary será su `secure_url`."""

    url: MediaUrl
    media_type: MediaType = MediaType.IMAGE
    caption: ShortText = None
    public_id: ShortText = None  # id del archivo en Cloudinary (a futuro)


class PortfolioMediaRead(PortfolioMediaIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int


class PortfolioItemCreate(BaseModel):
    title: Title
    description: Body
    status: ProjectStatus = ProjectStatus.EN_PROGRESO
    client_name: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=200)] = None
    project_url: OptionalUrl = None
    # El orden de la lista es el orden de la galería.
    media: list[PortfolioMediaIn] = Field(default_factory=list, max_length=MAX_GALLERY_ITEMS)
    # Compatibilidad con clientes de antes (una sola imagen): si no mandan `media`, se usa como
    # primer archivo de la galería. No se guarda como campo.
    image_url: ImageUrl = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def _legacy_image(self) -> "PortfolioItemCreate":
        if self.image_url and not self.media:
            self.media = [PortfolioMediaIn(url=self.image_url)]
        return self


class PortfolioItemRead(_Read):
    title: str
    description: str
    status: ProjectStatus
    client_name: str | None
    project_url: str | None
    media: list[PortfolioMediaRead]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def image_url(self) -> str | None:
        """Portada = primera imagen de la galería (compatibilidad con el campo de la v2.0)."""
        return next((m.url for m in self.media if m.media_type == MediaType.IMAGE), None)
