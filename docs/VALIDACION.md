# Validación — ajrdata-v3.2-rea

Verificado el 29 de octubre de 2026 sobre una copia del ZIP recibido. No se usaron credenciales
ni datos de producción. PostgreSQL 16, Python 3.12, navegador Chromium, API FastAPI y SMTP local.

## Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `pip install -r requirements.txt` / dependencias de pruebas | Instalación correcta |
| `alembic upgrade head` | Cadena completa desde base vacía hasta `0006_backup_email`: OK |
| `python -m tests.migration_test` | Downgrade a 0005 y upgrade a 0006: cuenta de prueba y cuentas existentes conservadas; tablas nuevas vacías |
| `python -m pytest tests/test_backup_email.py -q` | **21 pruebas aprobadas** |
| `python -m tests.smoke_test` | **236 comprobaciones aprobadas, 0 fallas** |
| `python -m tests.browser_test` | **2 recorridos completos aprobados**, escritorio ES y móvil EN, API/DB/SMTP reales |
| `npm ci --no-audit --no-fund` | Instalación reproducible: OK |
| `npm run lint` | Sin errores |
| `python check_i18n.py` | OK: claves y placeholders ES/EN, incluidas las nuevas |
| `npm run build` | TypeScript + Vite: OK |
| `python -m compileall -q backend/app backend/tests` | Compilación Python: OK |

Los recorridos de navegador cubren contraseña incorrecta sin perder el correo escrito, alta,
reenvío, verificación, conservación del respaldo anterior durante el cambio, persistencia al
recargar, confirmación antes de eliminar, eliminación, principal intacto y vuelta a `/cuenta`.
Se comprobó que el contenido no desborda horizontalmente a 390 px y se revisaron capturas internas.

Las pruebas de backend cubren también tokens ausentes/inválidos, destinos inválidos/ocupados,
intentos agotados, expiración y reutilización, carreras de envío/verificación/eliminación,
competencia con el registro principal, cuotas entre cuentas y conexiones, encabezados IP
falsificados, errores SMTP, avisos fallidos, purga, FK, auditoría y ausencia de secretos en
respuestas/logs del transporte de seguridad. Los tests contienen únicamente fixtures ficticios.

## Incidencias encontradas y resueltas

- Lockfile original incompleto: `npm ci` fallaba por dependencias i18n ausentes. Sincronizado.
- ESLint no estaba instalado/configurado pese a existir el script: agregado y ejecutado.
- Cuatro claves del componente de tema heredado estaban ausentes: completadas en ES/EN.
- El smoke test usaba direcciones `.test` que EmailStr rechaza, credenciales anteriores después
  de cambiarlas y tiempos fijos desactualizados. Corregidos los fixtures y las comprobaciones,
  manteniendo las pruebas de permisos y flujos existentes.
- La recarga de mensajes al reabrir soporte podía dejar el objeto remitente sin cargar. Se
  consultan explícitamente sus nombres sin alterar el contenido ni las métricas del chat.
- Se refresca el desafío tras el commit de cuotas para evitar usar un estado anterior en
  reenvíos concurrentes; una prueba específica confirma que solo sale un correo.
- Se sustituyó la confianza en cualquier proxy por una lista configurable y conservadora.

## Advertencias y límites reales

- Vite advierte un bundle JS mayor a 500 kB. La compilación termina correctamente; no se realizó
  una reestructuración ajena al alcance para reducirlo.
- Passlib heredado emite una advertencia de deprecación de `crypt` en Python 3.12. La versión de
  Python utilizada por el Dockerfile sigue siendo 3.12.
- No se ejecutó un despliegue remoto ni un build Docker completo. Se ejecutaron directamente
  los builds y pruebas de sus capas de aplicación.
- SMTP local probado; no se verificó un proveedor externo, entregabilidad real ni TLS del hosting.
- No se implementó recuperación de contraseñas, MFA ni una cola durable de avisos/rebotes.
- El entorno de trabajo requirió herramientas temporales para ejecutar PostgreSQL y descargar
  Chromium. Una repetición sobre el almacenamiento compartido produjo un error de archivos de
  PostgreSQL; se repitió en una base efímera local limpia con resultado satisfactorio. Estas
  herramientas, bases, cachés y capturas no forman parte del ZIP.

## Compatibilidad e integridad

Se comparó byte a byte `DashboardCharts.tsx` contra el ZIP original: sin cambios. Los módulos de
pedidos/cálculos y todas las migraciones anteriores también se conservan. La migración 0006 es
incremental; no exige re-registrar usuarios ni cambiar su correo o contraseña.

El ZIP se empaqueta sin dependencias instaladas, entornos virtuales, bases, secretos ni resultados
temporales. Se abre con `zipfile`, se verifican CRC y presencia de todos los archivos seleccionados.

## Archivos creados

- `backend/alembic/versions/0006_backup_email.py`
- `backend/app/api/routers/backup_email.py`
- `backend/app/crud/backup_email.py`
- `backend/app/models/backup_email.py`
- `backend/app/schemas/backup_email.py`
- `backend/app/scripts/purge_backup_email.py`
- `backend/app/services/__init__.py`
- `backend/app/services/backup_email.py`
- `backend/requirements-dev.txt`
- `backend/tests/browser_test.py`
- `backend/tests/migration_test.py`
- `backend/tests/test_backup_email.py`
- `docs/HISTORIAL_LANIAKEA_3.1.md`
- `frontend/eslint.config.js`
- `frontend/playwright.config.ts`
- `frontend/src/api/backupEmail.ts`
- `frontend/src/components/security/BackupEmailForms.tsx`
- `frontend/src/components/security/BackupEmailStatus.tsx`
- `frontend/src/i18n/parts/security.en.json`
- `frontend/src/i18n/parts/security.es.json`
- `frontend/src/pages/account/Seguridad.tsx`
- `frontend/tests/security.spec.ts`

## Archivos modificados

- `.env.example`
- `.gitignore`
- `README.md`
- `backend/app/core/audit.py`
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/app/core/email.py`
- `backend/app/core/scheduler.py`
- `backend/app/crud/support.py`
- `backend/app/crud/user.py`
- `backend/app/main.py`
- `backend/app/models/__init__.py`
- `backend/prestart.sh`
- `backend/tests/smoke_test.py`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/i18n/parts/layout.en.json`
- `frontend/src/i18n/parts/layout.es.json`
- `frontend/src/lib/errors.ts`
