from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import OrderStatus, value_enum


class ClientOrder(TimestampMixin, Base):
    """Pedido de proyecto enviado por una PyME desde el formulario público."""

    __tablename__ = "client_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200))
    contact_name: Mapped[str] = mapped_column(String(200))
    contact_email: Mapped[str] = mapped_column(String(320))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    industry: Mapped[str] = mapped_column(String(120))  # rubro de la PyME
    problem_description: Mapped[str] = mapped_column(Text)
    status: Mapped[OrderStatus] = mapped_column(
        value_enum(OrderStatus, "order_status"),
        default=OrderStatus.NUEVO,
        server_default=OrderStatus.NUEVO.value,
        index=True,
    )
