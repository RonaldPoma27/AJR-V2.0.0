# AJR Data 2.0

Sitio y panel de **AJR Data**, consultora tecnológica para PyMEs.

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + React Router (URLs limpias) + TanStack Query.
- **Backend:** FastAPI + SQLAlchemy 2 async + PostgreSQL + Alembic.
- **Deploy:** un solo servicio (monolito): el `Dockerfile` compila el frontend y FastAPI lo sirve junto con la API.

```
/
├── Dockerfile            # multi-stage (Node compila → Python sirve). Contexto = raíz
├── docker-compose.yml    # db + app para probar todo local
├── .env.example
├── frontend/             # React
└── backend/              # FastAPI (prestart.sh: migra, crea admin, arranca)
```

## Qué trae la 2.0

- **Menú "Nosotros"** (Contacto · Trabajá con nosotros), accesible por teclado y responsive.
- **Formulario de contacto** mejorado (validación, contador, "Enviar otro pedido") y nueva página **Trabajá con nosotros** (postulaciones).
- **Anti-spam en 3 capas:** honeypot + Cloudflare Turnstile + límite de envíos por IP.
- **Mails automáticos** (aviso al equipo + respuesta al cliente/candidato) en segundo plano: si el mail falla, el formulario igual responde bien.
- **Panel admin** (`/admin`): Pedidos, Postulaciones y Mi perfil, con contadores por estado, filtros, paginación y vista expandible.
- **Auth:** login, rutas protegidas, cierre de sesión, cambio de contraseña, admin creado automáticamente.
- Del backend nuevo se conservan tickets, servicios y blog (API lista; todavía sin pantallas).

> **Toda la API vive bajo `/api`** (`/api/orders`, `/api/portfolio`, `/api/docs`…). Así las URLs del sitio (`/portfolio`, `/admin/pedidos`) no chocan con la API y se puede recargar cualquier página sin 404.

---

## Correrlo local

### Opción A — Docker Compose (todo junto)

```bash
cp .env.example .env
# Editá .env: SECRET_KEY (generala, ver abajo) y, para entrar al panel, ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up --build
```

Abrí <http://localhost:8000>. Documentación de la API: <http://localhost:8000/api/docs>.

Generar una `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Opción B — Desarrollo con recarga en vivo

Necesitás un PostgreSQL (por ejemplo `docker run -e POSTGRES_PASSWORD=ajr -e POSTGRES_USER=ajr -e POSTGRES_DB=ajrdata -p 5432:5432 postgres:16-alpine`).

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env    # y descomentá/completá DATABASE_URL, SECRET_KEY, ADMIN_*
alembic upgrade head
python -m app.scripts.create_admin
uvicorn app.main:app --reload            # http://localhost:8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                              # http://localhost:5173  (proxy de /api → :8000)
```

## Crear el usuario admin

Se crea solo al arrancar (`prestart.sh` corre `python -m app.scripts.create_admin`) si están definidas:

| Variable | Descripción |
|---|---|
| `ADMIN_EMAIL` | Email para iniciar sesión |
| `ADMIN_PASSWORD` | Entre 8 y 72 caracteres |
| `ADMIN_FULL_NAME` | Opcional |

- Es **idempotente**: si el email ya existe no lo toca (no pisa una contraseña cambiada desde el panel).
- Si faltan variables, se saltea y el sitio arranca igual.
- Nunca imprime la contraseña. Se aceptan `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` (nombres de la versión anterior del backend).
- Después de entrar, cambiá la clave desde **Panel → Mi perfil**.
- Manual: `docker compose exec app python -m app.scripts.create_admin`.

Se ingresa desde el link **"Acceso equipo"** del pie de página (`/login`).

---

## Deploy en Render

1. **New → Web Service** desde este repo. Runtime: **Docker**.
2. **Dockerfile Path:** `./Dockerfile` · **Docker Build Context Directory:** `.` (la raíz).
3. **Health Check Path:** `/api/health`.
4. **Base de datos:** una PostgreSQL **nueva y vacía** (Render Postgres o Neon). Ver "Migrar desde la v1".
5. **Environment** (mínimo):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La URL de tu base (si es Neon/externa, con `?sslmode=require`) |
| `SECRET_KEY` | Aleatoria, **mínimo 32 caracteres** (si es más corta el backend no arranca) |
| `ENVIRONMENT` | `production` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME` | Admin inicial |
| `TURNSTILE_SECRET_KEY` | Secret de Turnstile (obligatoria en producción) |
| `VITE_TURNSTILE_SITE_KEY` | Sitekey de Turnstile (ver nota) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TLS` | Envío de mails |
| `ADMIN_NOTIFY_EMAIL` | A dónde llegan los avisos (default: `ADMIN_EMAIL`) |

> **Nota sobre `VITE_TURNSTILE_SITE_KEY`:** la sitekey se incorpora **al compilar** el frontend, por eso el Dockerfile la recibe como `ARG`. Si después de deployar el formulario dice "Falta configurar la verificación anti-spam", revisá en los logs de build que la variable haya llegado, o cambiala y redeployá con "Clear build cache".

Variables de la v1 que **ya no se usan**: `BACKEND_CORS_ORIGINS` (ahora `CORS_ORIGINS`, y en producción no hace falta porque todo sale del mismo dominio), `DB_SSL_REQUIRE` (usá `?sslmode=require` en la URL) y `VITE_API_URL`.

### Cloudflare Turnstile
1. En el dashboard de Cloudflare → **Turnstile → Add widget**, agregá tu dominio.
2. Copiá la *Site key* a `VITE_TURNSTILE_SITE_KEY` y la *Secret key* a `TURNSTILE_SECRET_KEY`.
3. En desarrollo podés usar las claves de prueba (siempre aprueban): sitekey `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`. Sin secret y con `ENVIRONMENT=development` la validación se saltea; en `production` **rechaza** los envíos.

### Mails
Con `SMTP_HOST` definido se mandan: *"Nuevo pedido de proyecto"* / *"Nueva postulación"* a `ADMIN_NOTIFY_EMAIL` (con `Reply-To` del cliente) y un auto-reply al cliente/candidato. Sin `SMTP_HOST` se omiten y se loguea.

⚠️ Algunos planes gratuitos de hosting bloquean los puertos SMTP salientes. Si en Render no salen mails, todo el envío está aislado en `backend/app/core/email.py` (`_deliver`): se cambia por la API HTTP de un proveedor (Resend, Brevo, etc.) sin tocar el resto.

---

## Migrar desde la v1

La base de datos de la v1 **no es compatible** con este backend (los IDs eran UUID y ahora son enteros, y el historial de Alembic es distinto: `alembic upgrade head` fallaría). Por eso:

1. **Creá una base nueva y vacía** y apuntá `DATABASE_URL` ahí. Las migraciones crean todo.
2. Si en la base vieja hay **pedidos que querés conservar**, exportalos antes (`\copy client_orders TO 'pedidos.csv' CSV HEADER`) y cargalos a mano en `client_orders` (campos: `company_name, contact_name, contact_email, contact_phone, industry, problem_description, status`).
3. Regenerá `SECRET_KEY` (mínimo 32 caracteres). Las sesiones viejas dejan de valer: hay que volver a iniciar sesión.
4. Los **proyectos** de la v1 ahora son ítems de `/api/portfolio` y los **partners** siguen en `/api/partners`. Se cargan con la API (`/api/docs`, botón *Authorize*) o directo en la base.

---

## Tests

Prueba de humo del backend contra un Postgres real (**borra los datos** de esa base; exige que su nombre contenga `test`):

```bash
cd backend
createdb ajr_test        # o CREATE DATABASE ajr_test;
export DATABASE_URL=postgresql+asyncpg://usuario:clave@localhost:5432/ajr_test
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
alembic upgrade head
python -m tests.smoke_test
```

Cubre: admin idempotente, login, permisos (401/403), formularios públicos (honeypot, rate limit, Turnstile simulado, mails simulados, SMTP caído), paginación/contadores/orden, cambio de contraseña, partners/portfolio y el fallback del frontend.

Frontend: `cd frontend && npm run build` (incluye `tsc -b`).

## Notas de seguridad

- Pedidos y postulaciones (datos personales) solo los ve un usuario con rol **ADMIN**. `POST /api/auth/register` sigue siendo público pero solo crea usuarios sin acceso al panel (también tiene límite por IP); si no lo usás, podés quitar el router de registro.
- El límite de envíos por IP vive **en memoria del proceso**: sirve con una sola instancia. Si se escala a varias, hay que moverlo a Redis.
- El login todavía no tiene límite de intentos por IP; conviene sumarlo si el panel queda expuesto a mucho tráfico.
- La subida de CV como archivo no está implementada (el disco de Render es efímero): por ahora se pega un link de Drive/Dropbox. `models/job_application.py` deja el lugar preparado.

- xd
