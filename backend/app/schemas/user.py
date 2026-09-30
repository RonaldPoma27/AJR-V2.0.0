from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import UserRole


class UserCreate(BaseModel):
    """Registro público. No acepta `role`: siempre se crea un USER."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt ignora lo que pasa de 72 bytes

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None = None
    role: UserRole


class PasswordChange(BaseModel):
    """Cambio de contraseña del usuario logueado (PATCH /users/me/password)."""

    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def _fits_bcrypt(cls, value: str) -> str:
        # bcrypt solo mira los primeros 72 *bytes*: con tildes/emojis 72 caracteres se pasan.
        if len(value.encode("utf-8")) > 72:
            raise ValueError("La contraseña es demasiado larga (máximo 72 bytes)")
        return value
