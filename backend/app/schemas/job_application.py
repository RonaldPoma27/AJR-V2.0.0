from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import ApplicationStatus
from app.schemas.common import OptionalPhone, OptionalUrl, _empty_to_none, text

Area = Literal[
    "Desarrollo Backend",
    "Desarrollo Frontend",
    "Datos e IA",
    "Diseño UI/UX",
    "Comercial/Ventas",
    "Otro",
]
ExperienceLevel = Literal["Estudiante", "Junior", "Semi-senior", "Senior"]
Availability = Literal["Full-time", "Part-time", "Freelance", "A definir"]

# Selects opcionales: "" llega como "sin elegir".
OptionalExperience = Annotated[ExperienceLevel | None, BeforeValidator(_empty_to_none)]
OptionalAvailability = Annotated[Availability | None, BeforeValidator(_empty_to_none)]


class JobApplicationCreate(BaseModel):
    full_name: text(2, 150)
    email: EmailStr = Field(max_length=320)
    phone: OptionalPhone = None
    location: text(2, 150)  # "Ciudad, País"
    area: Area
    experience_level: OptionalExperience = None
    linkedin_url: OptionalUrl = None
    github_url: OptionalUrl = None
    cv_url: OptionalUrl = None
    motivation: text(30, 3000)
    availability: OptionalAvailability = None
    consent: bool

    # No se guardan: anti-spam.
    turnstile_token: str | None = Field(default=None, max_length=4096)
    website: str | None = Field(default=None, max_length=500)  # honeypot

    @field_validator("consent")
    @classmethod
    def _consent_required(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Tenés que aceptar el tratamiento de tus datos personales")
        return value


class JobApplicationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ApplicationStatus


class JobApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str | None
    location: str
    area: str
    experience_level: str | None
    linkedin_url: str | None
    github_url: str | None
    cv_url: str | None
    motivation: str
    availability: str | None
    consent: bool
    consent_at: datetime | None
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime
