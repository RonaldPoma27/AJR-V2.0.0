from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Reauthenticate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=72, repr=False)

    @field_validator("current_password")
    @classmethod
    def byte_limit(cls, value: str) -> str:
        if len(value.encode()) > 72:
            raise ValueError("Password exceeds 72 bytes")
        return value


class BackupEmailRequest(Reauthenticate):
    email: EmailStr = Field(max_length=255)
    language: Literal["es", "en"] = "es"

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.lower()  # Same policy as primary addresses; preserve dots and +tags.


class BackupEmailResend(Reauthenticate):
    language: Literal["es", "en"] = "es"


class BackupEmailVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(pattern=r"^[0-9]{6}$", repr=False)
    language: Literal["es", "en"] = "es"


class BackupEmailDelete(Reauthenticate):
    language: Literal["es", "en"] = "es"


class BackupEmailState(BaseModel):
    status: Literal["not_configured", "pending", "verified"]
    email: str | None = None
    verified_at: datetime | None = None
    pending_email: str | None = None
    expires_at: datetime | None = None
    resend_available_at: datetime | None = None
    attempts_remaining: int | None = None
    challenge_expired: bool = False
    recovery_available: bool = False
    notification_sent: bool | None = None
