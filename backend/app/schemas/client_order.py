from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.enums import OrderStatus
from app.schemas.common import OptionalPhone, text


# Valores (slugs) que acepta la API. El frontend los traduce a texto (i18n `requestForm.*`).
PlanSlug = Literal["presencia-digital", "web-gestion", "sistema-a-medida"]
BudgetSlug = Literal["lt-100", "100-250", "250-450", "450-plus"]
TimelineSlug = Literal["1-2-weeks", "1-month", "2-3-months", "exploring"]

# Precio "desde" de cada plan en USD: base del gráfico de ingresos estimados del dashboard.
PLAN_BASE_PRICE_USD: dict[str, int] = {
    "presencia-digital": 100,
    "web-gestion": 250,
    "sistema-a-medida": 450,
}


class ClientOrderCreate(BaseModel):
    """Lo que envía el cliente logueado desde `/solicitar-proyecto` (el user_id sale del token)."""

    company_name: text(1, 200)
    contact_name: text(1, 200)
    contact_email: EmailStr = Field(max_length=320)
    contact_phone: OptionalPhone = None
    industry: text(1, 120)
    problem_description: text(10, 5000)

    # Formulario por pasos (2.4.1). Opcionales para no romper a clientes de la API anteriores.
    plan: PlanSlug | None = None
    budget: BudgetSlug | None = None
    timeline: TimelineSlug | None = None
    has_domain: bool | None = None

    # No se guardan: anti-spam.
    turnstile_token: str | None = Field(default=None, max_length=4096)
    website: str | None = Field(default=None, max_length=500)  # honeypot: debe venir vacío


class ClientOrderUpdate(BaseModel):
    """Panel admin: se cambia el estado y/o el paso del proyecto (al menos uno)."""

    model_config = ConfigDict(extra="forbid")

    status: OrderStatus | None = None
    project_step: int | None = Field(default=None, ge=1, le=5)

    @model_validator(mode="after")
    def _at_least_one(self) -> "ClientOrderUpdate":
        if self.status is None and self.project_step is None:
            raise ValueError("Enviá `status` o `project_step`")
        return self


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
    status: OrderStatus
    plan: str | None = None
    budget: str | None = None
    timeline: str | None = None
    has_domain: bool | None = None
    project_step: int = 1
    created_at: datetime
    updated_at: datetime


class MonthCount(BaseModel):
    month: str  # "2026-10"
    count: int


class PlanStat(BaseModel):
    plan: str
    count: int
    estimated_usd: int


class StepCount(BaseModel):
    step: int
    count: int


class DomainStats(BaseModel):
    own_domain: int
    needs_hosting: int


class OrderStats(BaseModel):
    """Datos de los gráficos del dashboard (solo pedidos activos, sin papelera)."""

    by_month: list[MonthCount]
    by_plan: list[PlanStat]
    by_step: list[StepCount]
    domain: DomainStats
    total: int
