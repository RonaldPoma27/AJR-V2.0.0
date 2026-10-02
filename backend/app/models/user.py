from sqlalchemy import Enum as SAEnum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str | None] = mapped_column(String(75))
    last_name: Mapped[str | None] = mapped_column(String(75))
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role"),
        default=UserRole.USER,
        server_default=UserRole.USER.name,
    )

    @property
    def full_name(self) -> str | None:
        """Nombre y apellido concatenados (None si no cargó ninguno)."""
        name = " ".join(part for part in (self.first_name, self.last_name) if part)
        return name or None

    @property
    def is_staff(self) -> bool:
        return self.role in (UserRole.TECHNICIAN, UserRole.ADMIN)
