from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.cms import ImageUrl
from app.schemas.common import text


class PartnerCreate(BaseModel):
    name: text(1, 200)
    logo_url: ImageUrl = None
    industry: text(1, 120)


class PartnerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: text(1, 200) | None = None
    logo_url: ImageUrl = None
    industry: text(1, 120) | None = None


class PartnerRead(PartnerCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
