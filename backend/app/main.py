from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

import logging

# uvicorn solo configura sus propios loggers: sin esto, los INFO de la app (mail "console",
# scheduler, purga de la papelera) no se ven en ningún lado.
logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")

from app.api.deps import DBSession
from app.api.routers import (
    applications,
    audit,
    auth,
    cms,
    orders,
    partners,
    support,
    team,
    tickets,
    trash,
    users,
)
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import AppError
from app.core.ip_guard import IpGuardMiddleware, guard
from app.core.scheduler import start_scheduler, stop_scheduler

# Carpeta con el frontend compilado (el Dockerfile copia `dist/` acá). Se resuelve desde
# este archivo, no desde el directorio de trabajo.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    await guard.load_active()  # bloqueos de IP vigentes (sobreviven a reinicios)
    start_scheduler()  # limpieza periódica de la papelera (APScheduler)
    yield
    stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

# Se agrega ANTES que CORS para quedar adentro: así los 429 también llevan los headers CORS.
app.add_middleware(IpGuardMiddleware)

# En producción el frontend sale del mismo dominio y CORS no interviene;
# sirve para desarrollo (Vite en :5173).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,  # la auth va por header Authorization, no por cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# --------------------------------------------------------------------------- API (/api)
api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(audit.router)
api.include_router(users.router)
api.include_router(orders.router)
api.include_router(applications.router)
api.include_router(partners.router)
api.include_router(tickets.router)
api.include_router(support.router)
api.include_router(team.router)
api.include_router(trash.router)
api.include_router(cms.services_router)
api.include_router(cms.portfolio_router)
api.include_router(cms.blog_router)


@api.get("/health", tags=["health"])
async def health(db: DBSession) -> dict[str, str]:
    await db.execute(text("SELECT 1"))
    return {"status": "ok"}


app.include_router(api)


# ------------------------------------------------- Frontend (monolito) + fallback de SPA
if (STATIC_DIR / "index.html").is_file():
    if (STATIC_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        # Un /api/... que no existe es un 404 de la API (JSON), no la página de inicio.
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Recurso no encontrado")

        # Archivos sueltos de static/ (favicon, etc.), sin poder salir de la carpeta.
        candidate = (STATIC_DIR / full_path).resolve()
        if candidate.is_file() and STATIC_DIR.resolve() in candidate.parents:
            return FileResponse(candidate)

        # Cualquier otra ruta es del router del frontend: recargar no da 404.
        return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})
