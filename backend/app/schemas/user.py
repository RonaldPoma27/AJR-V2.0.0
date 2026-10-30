import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import UserRole
from app.schemas.common import OptionalPersonName, PersonName


PASSWORD_RULES_MESSAGE = (
    "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial"
)
_UPPER = re.compile(r"[A-Z]")
_DIGIT = re.compile(r"\d")
_SPECIAL = re.compile(r"[^A-Za-z0-9\s]")


def validate_password_strength(value: str) -> str:
    """Política de contraseñas nuevas (registro y cambio). El login NO la aplica, para no
    bloquear a usuarios con contraseñas anteriores a esta regla."""
    if len(value.encode("utf-8")) > 72:  # bcrypt solo mira los primeros 72 *bytes*
        raise ValueError("La contraseña es demasiado larga (máximo 72 bytes)")
    if not (_UPPER.search(value) and _DIGIT.search(value) and _SPECIAL.search(value)):
        raise ValueError(PASSWORD_RULES_MESSAGE)
    return value


class UserCreate(BaseModel):
    """Registro público. No acepta `role`: siempre se crea un USER."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt ignora lo que pasa de 72 bytes
    first_name: OptionalPersonName = None
    last_name: OptionalPersonName = None
    turnstile_token: str | None = Field(default=None, max_length=4096)  # Cloudflare Turnstile

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def _strong_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserUpdate(BaseModel):
    """El usuario edita su propio nombre (PATCH /users/me). El email y el rol no se tocan acá."""

    model_config = ConfigDict(extra="forbid")

    first_name: PersonName
    last_name: PersonName


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None  # propiedad del modelo: first_name + last_name
    role: UserRole


class UserRegistered(UserRead):
    """Respuesta del registro: el usuario + su sesión ya iniciada.

    El token de Turnstile es de un solo uso (lo consume el registro), así que el frontend no
    puede hacer un login aparte sin pedir otro desafío: la sesión viene en la misma respuesta.
    """

    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    """Cambio de contraseña del usuario logueado (PATCH /users/me/password)."""

    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def _strong_password(cls, value: str) -> str:
        return validate_password_strength(value)


class EmailChange(BaseModel):
    """Cambio de email del usuario logueado (PATCH /users/me/email)."""

    model_config = ConfigDict(extra="forbid")

    current_email: EmailStr
    new_email: EmailStr
    current_password: str = Field(min_length=1, max_length=72)

    @field_validator("current_email", "new_email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()


class TechnicianPromote(BaseModel):
    """Panel admin: ascender a un usuario registrado a TECHNICIAN por su email."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()
