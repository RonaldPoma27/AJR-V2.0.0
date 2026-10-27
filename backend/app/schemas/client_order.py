from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import OrderStatus
from app.schemas.common import OptionalPhone, text


PlanKey = Literal["presencia-digital", "web-gestion", "sistema-medida"]
BudgetKey = Literal["lt-250", "250-499", "500-1499", "gte-1500"]
TimelineKey = Literal["1-2-semanas", "1-mes", "2-3-meses", "explorando"]


class ClientOrderCreate(BaseModel):
    """Lo que envía el cliente logueado desde `/solicitar-proyecto` (el user_id sale del token)."""

    company_name: text(1, 200)
    contact_name: text(1, 200)
    contact_email: EmailStr = Field(max_length=320)
    contact_phone: OptionalPhone = None
    industry: text(1, 120)
    problem_description: text(10, 5000)
    plan: PlanKey | None = None
    budget: BudgetKey | None = None
    timeline: TimelineKey | None = None
    has_domain: bool | None = None

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
    user_id: int | None  # None = pedido anterior a la v2.1 (se enviaba sin cuenta)
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: str | None
    industry: str
    problem_description: str
    plan: str | None = None
    budget: str | None = None
    timeline: str | None = None
    has_domain: bool | None = None
    status: OrderStatus
    created_at: datetime
    updated_at: datetime


class OrderStats(BaseModel):
    """Datos agregados para los gráficos del panel (solo pedidos activos, sin papelera)."""

    by_month: list[dict[str, int | str]]  # [{"month": "2026-10", "count": 4}] últimos 12 meses
    by_status: dict[str, int]
    by_plan: dict[str, int]  # incluye "sin-plan"
    by_domain: dict[str, int]  # "si" | "no" | "sin-dato"
