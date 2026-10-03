from datetime import datetime
from typing import Literal

from pydantic import BaseModel

TrashKind = Literal["order", "application"]


class TrashItem(BaseModel):
    kind: TrashKind
    id: int
    title: str
    subtitle: str
    deleted_at: datetime
    purge_at: datetime  # cuándo se elimina definitivamente
    seconds_left: int  # lo que falta, calculado en el servidor (no depende del reloj del cliente)


class TrashList(BaseModel):
    retention_days: int
    items: list[TrashItem]
