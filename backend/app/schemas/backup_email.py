"""Schemas públicos para administrar el correo de respaldo."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class BackupEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    current_password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.strip().lower()


class BackupEmailReauthenticate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=72)


class BackupEmailVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class BackupEmailState(BaseModel):
    status: Literal["not_configured", "pending", "verified"]
    email: str | None = None
    verified_at: datetime | None = None
    pending_email: str | None = None
    pending_expires_at: datetime | None = None
