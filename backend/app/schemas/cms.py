from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from app.models.enums import ProjectStatus
from app.schemas.common import OptionalUrl

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


# PUT reemplaza el recurso completo, por eso usa el mismo schema que POST.
class _ContentCreate(BaseModel):
    title: Title
    description: Body
    image_url: ImageUrl = None


class ServiceCreate(_ContentCreate):
    pass


class PortfolioItemCreate(_ContentCreate):
    status: ProjectStatus = ProjectStatus.EN_PROGRESO
    client_name: Annotated[str | None, StringConstraints(strip_whitespace=True, max_length=200)] = None
    project_url: OptionalUrl = None


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


class PortfolioItemRead(PortfolioItemCreate, _Read):
    pass


class BlogPostRead(BlogPostCreate, _Read):
    pass
