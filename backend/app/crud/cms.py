from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models import BlogPost, PortfolioItem, PortfolioMedia, Service
from app.schemas.cms import PortfolioItemCreate, PortfolioMediaIn

services = CRUDBase(Service)
blog_posts = CRUDBase(BlogPost)


def _build_media(media: list[PortfolioMediaIn]) -> list[PortfolioMedia]:
    return [
        PortfolioMedia(position=index, **item.model_dump()) for index, item in enumerate(media)
    ]


class PortfolioCRUD(CRUDBase[PortfolioItem]):
    """Igual que el CRUD genérico, pero la galería (`media`) se guarda en su propia tabla."""

    async def create(self, db: AsyncSession, payload: PortfolioItemCreate) -> PortfolioItem:  # type: ignore[override]
        data = payload.model_dump(exclude={"media"})
        obj = PortfolioItem(**data, media=_build_media(payload.media))
        db.add(obj)
        await db.commit()
        return obj

    async def update(  # type: ignore[override]
        self, db: AsyncSession, obj: PortfolioItem, payload: PortfolioItemCreate
    ) -> PortfolioItem:
        for field, value in payload.model_dump(exclude={"media"}).items():
            setattr(obj, field, value)
        obj.media = _build_media(payload.media)  # reemplaza la galería (delete-orphan)
        await db.commit()
        return obj


portfolio_items = PortfolioCRUD(PortfolioItem)
