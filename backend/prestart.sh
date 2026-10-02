#!/usr/bin/env sh
set -e

echo "[prestart] Aplicando migraciones..."
alembic upgrade head

echo "[prestart] Verificando usuario admin..."
# Si algo falla acá no queremos tirar el sitio abajo: se loguea y se sigue.
python -m app.scripts.create_admin || echo "[prestart] AVISO: no se pudo crear el admin (revisá los logs de arriba)."

echo "[prestart] Iniciando API..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" \
    --proxy-headers --forwarded-allow-ips="*"
