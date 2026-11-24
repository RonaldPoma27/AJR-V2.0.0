from datetime import datetime
import re
from typing import Annotated, Literal

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


# ------------------------------------------------------------------ portfolio (Haniel: editor Bento)
MAX_GALLERY_ITEMS = 30
MAX_PORTFOLIO_BLOCKS = 40


class PortfolioMediaIn(BaseModel):
    """Archivo legado de galería; se conserva por compatibilidad con versiones previas."""

    url: MediaUrl
    media_type: MediaType = MediaType.IMAGE
    caption: ShortText = None
    public_id: ShortText = None


class PortfolioMediaRead(PortfolioMediaIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int


class PortfolioTextMark(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    bold: bool = False
    italic: bool = False
    underline: bool = False
    color: str | None = None
    gradient_start: str | None = None
    gradient_end: str | None = None

    @model_validator(mode="after")
    def validate_range_and_colors(self) -> "PortfolioTextMark":
        if self.end <= self.start:
            raise ValueError("El rango de formato debe tener una longitud positiva")
        for value in (self.color, self.gradient_start, self.gradient_end):
            if value is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
                raise ValueError("Los colores deben estar expresados como HEX #RRGGBB")
        if bool(self.gradient_start) != bool(self.gradient_end):
            raise ValueError("Un degradado requiere sus dos colores")
        return self


class PortfolioStyle(BaseModel):
    background_color: str = "#151515"
    border_color: str = "#383838"
    accent_color: str = "#22D3EE"
    text_color: str = "#F3F4F6"

    @model_validator(mode="after")
    def validate_palette(self) -> "PortfolioStyle":
        for value in (self.background_color, self.border_color, self.accent_color, self.text_color):
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
                raise ValueError("Los colores deben estar expresados como HEX #RRGGBB")
        return self


BLOCK_TEXT_LIMITS = {"small": 140, "medium": 280, "large": 520, "wide": 640, "tall": 420, "full": 900}


class PortfolioBlockIn(BaseModel):
    id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    type: Literal["text", "image", "video", "file"]
    size: Literal["small", "medium", "large", "wide", "tall", "full"] = "medium"
    text: str = Field(default="", max_length=900)
    url: MediaUrl | None = None
    caption: ShortText = None
    background_color: str = "#1B1B1B"
    border_color: str = "#383838"
    text_color: str = "#F3F4F6"
    gradient_start: str | None = None
    gradient_end: str | None = None
    fit: Literal["contain", "cover"] = "contain"
    marks: list[PortfolioTextMark] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_block(self) -> "PortfolioBlockIn":
        if self.type == "text":
            if not self.text.strip():
                raise ValueError("Los bloques de texto no pueden estar vacíos")
            if len(self.text) > BLOCK_TEXT_LIMITS[self.size]:
                raise ValueError(f"El bloque {self.size} admite hasta {BLOCK_TEXT_LIMITS[self.size]} caracteres")
            if self.url is not None:
                raise ValueError("Un bloque de texto no admite URL")
            if any(mark.end > len(self.text) for mark in self.marks):
                raise ValueError("El formato de texto excede la longitud del contenido")
        elif self.url is None:
            raise ValueError("Los bloques multimedia requieren una URL")
        for value in (self.background_color, self.border_color, self.text_color):
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
                raise ValueError("Los colores deben estar expresados como HEX #RRGGBB")
        for value in (self.gradient_start, self.gradient_end):
            if value is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
                raise ValueError("Los colores del degradado deben estar expresados como HEX #RRGGBB")
        if bool(self.gradient_start) != bool(self.gradient_end):
            raise ValueError("Un degradado requiere sus dos colores")
        return self


class PortfolioItemCreate(BaseModel):
    title: Title
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)] = ""
    status: ProjectStatus = ProjectStatus.EN_PROGRESO
    client_name: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=200)] = None
    project_url: OptionalUrl = None
    logo_url: MediaUrl | None = None
    media: list[PortfolioMediaIn] = Field(default_factory=list, max_length=MAX_GALLERY_ITEMS)
    style: PortfolioStyle = Field(default_factory=PortfolioStyle)
    blocks: list[PortfolioBlockIn] = Field(default_factory=list, max_length=MAX_PORTFOLIO_BLOCKS)
    image_url: ImageUrl = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def _legacy_image(self) -> "PortfolioItemCreate":
        if self.image_url and not self.media:
            self.media = [PortfolioMediaIn(url=self.image_url)]
        return self


class PortfolioOrderUpdate(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_ids(self) -> "PortfolioOrderUpdate":
        if len(set(self.ids)) != len(self.ids):
            raise ValueError("La lista de prioridad contiene proyectos repetidos")
        return self

class PortfolioItemRead(_Read):
    title: str
    description: str
    status: ProjectStatus
    client_name: str | None
    project_url: str | None
    logo_url: str | None
    position: int
    style: PortfolioStyle
    blocks: list[PortfolioBlockIn]
    media: list[PortfolioMediaRead]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def image_url(self) -> str | None:
        """Portada = primera imagen de la galería (compatibilidad con el campo de la v2.0)."""
        return next((m.url for m in self.media if m.media_type == MediaType.IMAGE), None)
