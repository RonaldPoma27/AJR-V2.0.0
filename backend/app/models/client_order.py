from sqlalchemy import Boolean, ForeignKey, String, Text
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
    # v2.5: datos del formulario por pasos. Opcionales: los pedidos anteriores no los tienen.
    plan: Mapped[str | None] = mapped_column(String(30))  # presencia-digital | web-gestion | sistema-medida
    budget: Mapped[str | None] = mapped_column(String(20))  # lt-250 | 250-499 | 500-1499 | gte-1500
    timeline: Mapped[str | None] = mapped_column(String(20))  # 1-2-semanas | 1-mes | 2-3-meses | explorando
    has_domain: Mapped[bool | None] = mapped_column(Boolean)  # ¿ya tiene dominio/hosting?
    status: Mapped[OrderStatus] = mapped_column(
        value_enum(OrderStatus, "order_status"),
        default=OrderStatus.NUEVO,
        server_default=OrderStatus.NUEVO.value,
        index=True,
    )
