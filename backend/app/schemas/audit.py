from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: int
    user_id: int | None
    user_email: str | None
    user_role: str | None
    action: str
    entity: str | None
    entity_id: str | None
    entity_label: str | None
    changes: dict[str, Any] | None
    ip: str | None
    method: str | None
    path: str | None
    detail: str | None
    created_at: datetime  # UTC
    # Fecha y hora en la zona horaria de Argentina, ya armadas por el servidor.
    date_ar: str  # DD/MM/AAAA
    time_ar: str  # HH:MM:SS
    timezone: str  # "America/Argentina/Buenos_Aires (UTC-03:00)"


class AuditPage(BaseModel):
    total: int
    items: list[AuditLogRead]


class AuditUser(BaseModel):
    id: int | None
    email: str


class AuditFilters(BaseModel):
    users: list[AuditUser]
    actions: list[str]
    entities: list[str]


class IpBlockRead(BaseModel):
    ip: str
    kind: str
    reason: str
    retry_after: int  # segundos que faltan
    blocked_until: datetime
