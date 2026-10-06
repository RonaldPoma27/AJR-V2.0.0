from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.enums import TicketStatus
from app.schemas.user import UserRead

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1_000)]


class TicketCreate(BaseModel):
    # extra="forbid": si el cliente manda `user_id` (u otro campo) recibe 422 en vez de ser ignorado.
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: LongText


class TicketStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: TicketStatus
    estimated_cost: float | None = Field(default=None, ge=0, le=1_000_000_000)
    message: ShortText | None = None


class TicketCommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: LongText


class TicketUpdateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    author: UserRead
    previous_status: TicketStatus | None
    new_status: TicketStatus
    message: str
    created_at: datetime


class TicketCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    author: UserRead
    content: str
    created_at: datetime


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    owner: UserRead
    title: str
    description: str
    status: TicketStatus
    estimated_cost: float | None
    created_at: datetime
    updated_at: datetime


class TicketDetail(TicketRead):
    updates: list[TicketUpdateRead] = []
    comments: list[TicketCommentRead] = []
