from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import OrderStatus
from app.schemas.common import OptionalPhone, text


class ClientOrderCreate(BaseModel):
    """Lo que envía el visitante desde el formulario público (`OrderForm`)."""

    company_name: text(1, 200)
    contact_name: text(1, 200)
    contact_email: EmailStr = Field(max_length=320)
    contact_phone: OptionalPhone = None
    industry: text(1, 120)
    problem_description: text(10, 5000)

    # No se guardan: anti-spam.
    turnstile_token: str | None = Field(default=None, max_length=4096)
    website: str | None = Field(default=None, max_length=500)  # honeypot: debe venir vacío


class ClientOrderUpdate(BaseModel):
    """Panel admin: solo se cambia el estado."""

    model_config = ConfigDict(extra="forbid")

    status: OrderStatus


class ClientOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: str | None
    industry: str
    problem_description: str
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
