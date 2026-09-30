# syntax=docker/dockerfile:1
# Monolito: FastAPI sirve la API (/api) y el frontend compilado (static/).
# El contexto de build es la RAÍZ del repo.

# ---------- Etapa 1: compilar el frontend ----------
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
# Sitekey pública de Cloudflare Turnstile: se "hornea" en el build de Vite.
ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
RUN npm run build

# ---------- Etapa 2: API + frontend ----------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./static

# prestart.sh: migraciones -> admin inicial -> uvicorn. Sin privilegios de root.
RUN sed -i 's/\r$//' prestart.sh && chmod +x prestart.sh \
    && useradd --system --no-create-home appuser
USER appuser

EXPOSE 8000
CMD ["./prestart.sh"]
