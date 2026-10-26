from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.deps import AdminUser, DBSession
from app.core.exceptions import AppError
from app.crud import partner as crud_partner
from app.schemas.partner import PartnerCreate, PartnerRead, PartnerUpdate

router = APIRouter(prefix="/partners", tags=["partners"])

NOT_FOUND = "Partner no encontrado"


@router.get("", response_model=list[PartnerRead])
async def list_partners(
    db: DBSession,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
):
    """Público: "Con quiénes trabajamos" (lo consume la Home)."""
    return await crud_partner.get_multi(db, skip=skip, limit=limit)


@router.post("", response_model=PartnerRead, status_code=201)
async def create_partner(payload: PartnerCreate, db: DBSession, _: AdminUser):
    return await crud_partner.create(db, payload)


@router.patch("/{partner_id}", response_model=PartnerRead)
async def update_partner(partner_id: int, payload: PartnerUpdate, db: DBSession, _: AdminUser):
    partner = await crud_partner.get(db, partner_id)
    if partner is None:
        raise AppError(404, NOT_FOUND)
    return await crud_partner.update(db, partner, payload)


@router.delete("/{partner_id}", status_code=204)
async def delete_partner(partner_id: int, db: DBSession, _: AdminUser):
    partner = await crud_partner.get(db, partner_id)
    if partner is None:
        raise AppError(404, NOT_FOUND)
    await crud_partner.remove(db, partner)
    return Response(status_code=204)
