from sqlalchemy import Boolean, CheckConstraint, ForeignKey, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin
from app.models.enums import OrderStatus, value_enum


class ClientOrder(SoftDeleteMixin, TimestampMixin, Base):
    """Pedido de proyecto enviado por un cliente registrado desde `/solicitar-proyecto`."""

    __tablename__ = "client_orders"
    __table_args__ = (CheckConstraint("project_step BETWEEN 1 AND 5", name="project_step_range"),)

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
    # --- v2.4.1: datos del formulario por pasos y avance del proyecto -------------------------
    # Valores validados en el schema (ver app/schemas/client_order.py). Nullable: los pedidos
    # anteriores a la 2.4.1 no los tienen y no se inventan.
    plan: Mapped[str | None] = mapped_column(String(30), index=True)
    budget: Mapped[str | None] = mapped_column(String(20))
    timeline: Mapped[str | None] = mapped_column(String(20))
    has_domain: Mapped[bool | None] = mapped_column(Boolean)
    # Paso del proyecto que ve el cliente (1 Análisis … 5 Entregado). Lo cambia el equipo.
    project_step: Mapped[int] = mapped_column(
        SmallInteger, default=1, server_default=text("1")
    )
