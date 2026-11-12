from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrderRegretRequest(BaseModel):
    """Solicitud pública; no exige una sesión, pero valida los datos del pedido."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    order_id: int = Field(gt=0)
    contact_email: EmailStr = Field(max_length=320)


class OrderRegretReceipt(BaseModel):
    request_code: str
    requested_at: datetime
    message: str = "Solicitud recibida. Conservá el código de seguimiento para consultar el trámite."
