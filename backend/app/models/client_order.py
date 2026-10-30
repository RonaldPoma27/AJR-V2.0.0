from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin
from app.models.enums import OrderStatus, value_enum


class ClientOrder(SoftDeleteMixin, TimestampMixin, Base):
    """Pedido de proyecto enviado por un cliente registrado desde `/solicitar-proyecto`."""

    __tablename__ = "client_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Dueño del pedido. Nullable solo por los pedidos anteriores a la v2.1 (se enviaban sin
    # cuenta); los nuevos siempre lo traen. SET NULL: borrar un usuario no borra el pedido.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
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
