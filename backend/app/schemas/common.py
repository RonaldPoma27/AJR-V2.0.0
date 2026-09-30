"""Piezas reutilizables por los schemas: tipos validados, página y acuse de recibo."""
from typing import Annotated, Any, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, BeforeValidator, StringConstraints

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Respuesta paginada de los listados del panel admin.

    - total:  cantidad de ítems que cumplen el filtro actual (para armar la paginación).
    - counts: cantidad por estado sobre TODA la tabla (para los contadores del panel).
    """

    total: int
    items: list[T]
    counts: dict[str, int]


class Receipt(BaseModel):
    """Respuesta de los formularios públicos. No devuelve datos guardados."""

    ok: bool = True


def _empty_to_none(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _validate_http_url(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if len(value) > 500:
        raise ValueError("El link no puede superar los 500 caracteres")
    if not value.lower().startswith(("http://", "https://")) or " " in value:
        raise ValueError("El link debe empezar con http:// o https://")
    return value


def _clean_phone(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if len(value) > 50:
        raise ValueError("El teléfono es demasiado largo")
    if not all(ch.isdigit() or ch in "+-() ." for ch in value):
        raise ValueError("El teléfono solo puede tener números, espacios y + - ( )")
    return value


def text(min_length: int = 1, max_length: int = 200):
    return Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)
    ]


# Opcionales: un string vacío se guarda como NULL.
OptionalUrl = Annotated[
    str | None, BeforeValidator(_empty_to_none), AfterValidator(_validate_http_url)
]
OptionalPhone = Annotated[
    str | None, BeforeValidator(_empty_to_none), AfterValidator(_clean_phone)
]
