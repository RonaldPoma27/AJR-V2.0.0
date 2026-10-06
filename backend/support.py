from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models.enums import SupportTicketStatus
from app.models.support import MAX_MESSAGE_LENGTH
from app.schemas.user import UserRead

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
MessageText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_MESSAGE_LENGTH)
]


class SupportTicketCreate(BaseModel):
    """Para iniciar un chat hace falta un título y el primer mensaje."""

    model_config = ConfigDict(extra="forbid")

    title: Title
    message: MessageText


class SupportMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: MessageText


class SupportStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: SupportTicketStatus


class SupportMessageRead(BaseModel):
    id: int
    ticket_id: int
    sender_id: int
    sender_name: str
    from_customer: bool  # True = lo escribió el dueño del chat; False = el equipo
    content: str
    created_at: datetime


class SupportTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    owner: UserRead
    title: str
    status: SupportTicketStatus
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime
    first_response_at: datetime | None


class SupportTicketDetail(SupportTicketRead):
    messages: list[SupportMessageRead]
    # Calculado para quien consulta: ¿puede escribir ahora? Si no, por qué.
    can_send: bool
    block_reason: Literal["closed", "awaiting_support"] | None = None
