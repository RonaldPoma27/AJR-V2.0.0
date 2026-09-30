from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.api.deps import DBSession, require_admin
from app.crud import cms as crud_cms
from app.crud.base import CRUDBase
from app.schemas.cms import (
    BlogPostCreate,
    BlogPostRead,
    PortfolioItemCreate,
    PortfolioItemRead,
    ServiceCreate,
    ServiceRead,
)

# Lecturas públicas; escrituras solo ADMIN.
admin_only = [Depends(require_admin)]

Skip = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]


async def _get_or_404(crud: CRUDBase, db: DBSession, item_id: int):
    obj = await crud.get(db, item_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return obj


# ---------------------------------------------------------------- servicios
services_router = APIRouter(prefix="/services", tags=["cms: services"])


@services_router.get("", response_model=list[ServiceRead])
async def list_services(db: DBSession, skip: Skip = 0, limit: Limit = 50):
    return await crud_cms.services.get_multi(db, skip=skip, limit=limit)


@services_router.get("/{item_id}", response_model=ServiceRead)
async def get_service(item_id: int, db: DBSession):
    return await _get_or_404(crud_cms.services, db, item_id)


@services_router.post(
    "", response_model=ServiceRead, status_code=201, dependencies=admin_only
)
async def create_service(payload: ServiceCreate, db: DBSession):
    return await crud_cms.services.create(db, payload)


@services_router.put("/{item_id}", response_model=ServiceRead, dependencies=admin_only)
async def update_service(item_id: int, payload: ServiceCreate, db: DBSession):
    obj = await _get_or_404(crud_cms.services, db, item_id)
    return await crud_cms.services.update(db, obj, payload)


@services_router.delete("/{item_id}", status_code=204, dependencies=admin_only)
async def delete_service(item_id: int, db: DBSession):
    obj = await _get_or_404(crud_cms.services, db, item_id)
    await crud_cms.services.remove(db, obj)
    return Response(status_code=204)


# ---------------------------------------------------------------- portfolio
portfolio_router = APIRouter(prefix="/portfolio", tags=["cms: portfolio"])


@portfolio_router.get("", response_model=list[PortfolioItemRead])
async def list_portfolio(db: DBSession, skip: Skip = 0, limit: Limit = 50):
    return await crud_cms.portfolio_items.get_multi(db, skip=skip, limit=limit)


@portfolio_router.get("/{item_id}", response_model=PortfolioItemRead)
async def get_portfolio_item(item_id: int, db: DBSession):
    return await _get_or_404(crud_cms.portfolio_items, db, item_id)


@portfolio_router.post(
    "", response_model=PortfolioItemRead, status_code=201, dependencies=admin_only
)
async def create_portfolio_item(payload: PortfolioItemCreate, db: DBSession):
    return await crud_cms.portfolio_items.create(db, payload)


@portfolio_router.put(
    "/{item_id}", response_model=PortfolioItemRead, dependencies=admin_only
)
async def update_portfolio_item(item_id: int, payload: PortfolioItemCreate, db: DBSession):
    obj = await _get_or_404(crud_cms.portfolio_items, db, item_id)
    return await crud_cms.portfolio_items.update(db, obj, payload)


@portfolio_router.delete("/{item_id}", status_code=204, dependencies=admin_only)
async def delete_portfolio_item(item_id: int, db: DBSession):
    obj = await _get_or_404(crud_cms.portfolio_items, db, item_id)
    await crud_cms.portfolio_items.remove(db, obj)
    return Response(status_code=204)


# --------------------------------------------------------------------- blog
blog_router = APIRouter(prefix="/blog", tags=["cms: blog"])


@blog_router.get("", response_model=list[BlogPostRead])
async def list_blog_posts(db: DBSession, skip: Skip = 0, limit: Limit = 50):
    return await crud_cms.blog_posts.get_multi(db, skip=skip, limit=limit)


@blog_router.get("/{item_id}", response_model=BlogPostRead)
async def get_blog_post(item_id: int, db: DBSession):
    return await _get_or_404(crud_cms.blog_posts, db, item_id)


@blog_router.post("", response_model=BlogPostRead, status_code=201, dependencies=admin_only)
async def create_blog_post(payload: BlogPostCreate, db: DBSession):
    return await crud_cms.blog_posts.create(db, payload)


@blog_router.put("/{item_id}", response_model=BlogPostRead, dependencies=admin_only)
async def update_blog_post(item_id: int, payload: BlogPostCreate, db: DBSession):
    obj = await _get_or_404(crud_cms.blog_posts, db, item_id)
    return await crud_cms.blog_posts.update(db, obj, payload)


@blog_router.delete("/{item_id}", status_code=204, dependencies=admin_only)
async def delete_blog_post(item_id: int, db: DBSession):
    obj = await _get_or_404(crud_cms.blog_posts, db, item_id)
    await crud_cms.blog_posts.remove(db, obj)
    return Response(status_code=204)
