
"""Compatibilidad con la revisión 0005_order_plan_fields.

La aplicación actual no utiliza campos independientes de plan
en ClientOrder. Se conserva la revisión para compatibilidad con
bases de datos que ya la tienen registrada.
"""
from collections.abc import Sequence

revision: str = "0005_order_plan_fields"
down_revision: str | None = "0004_audit_and_ip_blocks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Sin cambios: el modelo actual no necesita nuevas columnas.
    pass


def downgrade() -> None:
    # No eliminar posibles columnas heredadas ni datos existentes.
    pass
