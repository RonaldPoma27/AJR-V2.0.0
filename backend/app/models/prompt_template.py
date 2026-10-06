from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PromptTemplate(TimestampMixin, Base):
    """Plantilla de prompt reutilizable por el equipo (portada de la v1: solo tabla, sin API)."""

    __tablename__ = "prompt_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(120), index=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
