from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Partner(TimestampMixin, Base):
    """Empresa o cliente con quien AJR Data trabaja ("Con quiénes trabajamos")."""

    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    industry: Mapped[str] = mapped_column(String(120))
