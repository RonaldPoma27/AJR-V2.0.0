import enum

from sqlalchemy import Enum as SAEnum


class UserRole(str, enum.Enum):
    USER = "USER"
    TECHNICIAN = "TECHNICIAN"
    ADMIN = "ADMIN"


class TicketStatus(str, enum.Enum):
    PENDING = "PENDING"
    DIAGNOSING = "DIAGNOSING"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    APPROVED = "APPROVED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class OrderStatus(str, enum.Enum):
    """Estado de un pedido de proyecto (mismos valores que la v1)."""

    NUEVO = "nuevo"
    EN_REVISION = "en_revision"
    CONTACTADO = "contactado"
    DESCARTADO = "descartado"


class ProjectStatus(str, enum.Enum):
    """Estado de un trabajo del portfolio (mismos valores que la v1)."""

    TERMINADO = "terminado"
    EN_PROGRESO = "en_progreso"


class ApplicationStatus(str, enum.Enum):
    NUEVA = "nueva"
    EN_REVISION = "en_revision"
    ENTREVISTA = "entrevista"
    DESCARTADA = "descartada"
    CONTRATADA = "contratada"


def value_enum(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """Enum de Postgres que persiste los *valores* en minúscula (no los nombres).

    create_type=False: el tipo lo crea la migración de Alembic, una sola vez.
    """
    return SAEnum(
        enum_cls,
        name=name,
        create_type=False,
        values_callable=lambda cls: [member.value for member in cls],
    )
