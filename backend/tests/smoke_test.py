"""Prueba de humo end-to-end del backend contra un Postgres real.

    cd backend
    DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/ajr_test \
    SECRET_KEY=<32+ caracteres> python -m tests.smoke_test

⚠️ BORRA los datos de la base indicada: solo corre si el nombre de la base contiene "test"
(o si definís SMOKE_TEST_FORCE=1). Antes hay que haber corrido `alembic upgrade head`.
"""
import asyncio
import os
import shutil
import sys
from pathlib import Path

import httpx

DB_URL = os.environ.get("DATABASE_URL", "")
if "test" not in DB_URL.rsplit("/", 1)[-1] and os.environ.get("SMOKE_TEST_FORCE") != "1":
    sys.exit("Abortado: el nombre de la base debe contener 'test' (esto borra datos).")

# Entorno controlado, antes de importar la app.
os.environ.update(
    ENVIRONMENT="development",
    ADMIN_EMAIL="admin@ajr.test",
    ADMIN_PASSWORD="clave-inicial-123",
    ADMIN_FULL_NAME="Admin de Prueba",
    ADMIN_NOTIFY_EMAIL="avisos@ajr.test",
    SMTP_HOST="smtp.invalido.test",
    SMTP_FROM="hola@ajr.test",
    RATE_LIMIT_PER_HOUR="5",
    IP_GUARD_ENABLED="false",  # el flujo general hace muchos pedidos desde una IP; se prueba aparte
)
os.environ.pop("TURNSTILE_SECRET_KEY", None)

# Frontend "falso" para probar el fallback de SPA.
STATIC = Path(__file__).resolve().parent.parent / "static"
created_static = not STATIC.exists()
(STATIC / "assets").mkdir(parents=True, exist_ok=True)
(STATIC / "index.html").write_text("<html><body>SPA-INDEX</body></html>")
(STATIC / "assets" / "app.js").write_text("console.log('ok')")
(STATIC.parent / "secreto.txt").write_text("no deberías poder leer esto")

from sqlalchemy import func, select, text  # noqa: E402

from app.core import email as email_mod  # noqa: E402
from app.core import turnstile as turnstile_mod  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.core.ip_guard import guard  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.core import scheduler as scheduler_mod  # noqa: E402
from app.crud import trash as crud_trash  # noqa: E402
from app.models import ClientOrder, JobApplication, SupportMessage, SupportTicket, User  # noqa: E402
from app.models.base import utcnow  # noqa: E402

PASSED = 0
FAILED: list[str] = []


def check(name: str, condition: bool, extra: object = "") -> None:
    global PASSED
    if condition:
        PASSED += 1
        print(f"  ok  {name}")
    else:
        FAILED.append(name)
        print(f"  FALLA  {name}  {extra}")


ORDER = {
    "company_name": "Panadería Sol",
    "contact_name": "Lucía Pérez",
    "contact_email": "lucia@panaderiasol.com",
    "contact_phone": "+54 11 5555-1234",
    "industry": "Gastronomía",
    "problem_description": "Necesitamos un sistema para gestionar los pedidos de los clientes.",
}
APPLICATION = {
    "full_name": "Juan Gómez",
    "email": "juan@correo.com",
    "phone": "",
    "location": "Rosario, Argentina",
    "area": "Desarrollo Backend",
    "experience_level": "Semi-senior",
    "linkedin_url": "https://linkedin.com/in/juan",
    "github_url": "",
    "cv_url": "https://drive.google.com/file/d/abc",
    "motivation": "Me encanta el desarrollo a medida y quiero aprender IA aplicada a PyMEs.",
    "availability": "Full-time",
    "consent": True,
}


async def login(c: httpx.AsyncClient, email: str, password: str) -> httpx.Response:
    return await c.post("/api/auth/login", data={"username": email, "password": password})


async def main() -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, client_orders, job_applications, partners, portfolio_items, "
                "portfolio_media, support_tickets, support_messages, audit_logs, ip_blocks "
                "RESTART IDENTITY CASCADE"
            )
        )

    sent: list = []
    email_mod._deliver = lambda msg: sent.append(msg)  # no mandamos mails de verdad

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        # ------------------------------------------------------------ create_admin
        print("\n[create_admin]")
        from app.scripts.create_admin import create_admin

        await create_admin()
        await create_admin()  # idempotente
        async with AsyncSessionLocal() as s:
            n = await s.scalar(text("select count(*) from users where email='admin@ajr.test'"))
        check("crea el admin una sola vez (idempotente)", n == 1, n)

        # ------------------------------------------------------------- health / auth
        print("\n[health y auth]")
        r = await c.get("/api/health")
        check("GET /api/health", r.status_code == 200 and r.json() == {"status": "ok"}, r.text)
        check("login con clave incorrecta -> 401", (await login(c, "admin@ajr.test", "mala-clave")).status_code == 401)
        r = await login(c, "admin@ajr.test", "clave-inicial-123")
        check("login del admin creado por el script", r.status_code == 200, r.text)
        admin = {"Authorization": f"Bearer {r.json()['access_token']}"}
        me = (await c.get("/api/auth/me", headers=admin)).json()
        check("/auth/me devuelve rol ADMIN y full_name", me["role"] == "ADMIN" and me["full_name"] == "Admin de Prueba", me)

        limiter.reset()
        r = await c.post("/api/auth/register", json={"email": "cliente@x.com", "password": "Clave-cliente-1!", "first_name": "  Lucía ", "last_name": "Pérez"})
        check("registro crea USER con nombre/apellido (full_name derivado)", r.status_code == 201 and r.json()["role"] == "USER" and r.json()["first_name"] == "Lucía" and r.json()["full_name"] == "Lucía Pérez", r.text)
        check("registro no acepta role (se ignora)", (await c.post("/api/auth/register", json={"email": "x2@x.com", "password": "Clave-cliente-1!", "role": "ADMIN"})).json()["role"] == "USER")
        user_tok = (await login(c, "cliente@x.com", "Clave-cliente-1!")).json()["access_token"]
        user = {"Authorization": f"Bearer {user_tok}"}

        # ---------------------------------------------------------------- pedidos
        print("\n[pedidos]")
        limiter.reset()
        sent.clear()
        check("POST /orders sin sesión -> 401", (await c.post("/api/orders", json=ORDER)).status_code == 401)
        r = await c.post("/api/orders", headers=user, json=ORDER)
        check("POST /orders con sesión -> 201 Receipt", r.status_code == 201 and r.json() == {"ok": True}, r.text)
        check("se envían 2 mails (admin + auto-reply)", len(sent) == 2, len(sent))
        if len(sent) == 2:
            admin_mail, reply = sent
            check("mail admin: asunto y destinatario", admin_mail["Subject"] == "Nuevo pedido de proyecto" and admin_mail["To"] == "avisos@ajr.test", dict(admin_mail))
            check("mail admin: Reply-To = cliente", admin_mail["Reply-To"] == ORDER["contact_email"])
            check("auto-reply al cliente", reply["To"] == ORDER["contact_email"] and "Recibimos tu solicitud en AJR Data, la revisaremos pronto" in reply.get_body(("plain",)).get_content())

        # SMTP roto: la respuesta HTTP sigue siendo exitosa
        def boom(msg):
            raise OSError("SMTP caído")

        email_mod._deliver = boom
        r = await c.post("/api/orders", headers=user, json={**ORDER, "company_name": "Con SMTP roto"})
        check("si falla el SMTP la respuesta sigue siendo 201", r.status_code == 201, r.text)
        email_mod._deliver = lambda msg: sent.append(msg)

        # Inyección de headers en el nombre no rompe ni se cuela
        sent.clear()
        r = await c.post("/api/orders", headers=user, json={**ORDER, "contact_name": "Ana\r\nBcc: robo@x.com", "company_name": "Inyección"})
        check("nombre con \\r\\n aceptado y sanitizado", r.status_code == 201 and all("Bcc" not in m.keys() for m in sent), r.text)

        before = await count(ClientOrder)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "website": "http://spam.com"})
        check("honeypot lleno: 201 pero no guarda", r.status_code == 201 and await count(ClientOrder) == before)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "contact_email": "no-es-email"})
        check("email inválido -> 422", r.status_code == 422)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "problem_description": "corto"})
        check("descripción muy corta -> 422", r.status_code == 422)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "contact_phone": "abc"})
        check("teléfono inválido -> 422", r.status_code == 422)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "contact_phone": ""})
        check("teléfono vacío se acepta (opcional)", r.status_code == 201, r.text)

        limiter.reset()
        codes = [(await c.post("/api/orders", headers=user, json=ORDER)).status_code for _ in range(7)]
        check("rate limit: 5 pasan y después 429", codes == [201] * 5 + [429] * 2, codes)

        # listado protegido
        print("\n[listado admin de pedidos]")
        check("GET /orders sin token -> 401", (await c.get("/api/orders")).status_code == 401)
        check("GET /orders con rol USER -> 403", (await c.get("/api/orders", headers=user)).status_code == 403)
        r = await c.get("/api/orders", headers=admin)
        page = r.json()
        total_in_db = await count(ClientOrder)
        check("Page {total, items, counts}", r.status_code == 200 and set(page) == {"total", "items", "counts"}, r.text[:200])
        check("total = filas en la base", page["total"] == total_in_db, (page["total"], total_in_db))
        ids = [o["id"] for o in page["items"]]
        check("orden descendente (más nuevos primero)", ids == sorted(ids, reverse=True), ids)
        check("counts incluye todos los estados", set(page["counts"]) == {"nuevo", "en_revision", "contactado", "finalizado", "descartado"}, page["counts"])
        check("contadores suman el total", sum(page["counts"].values()) == total_in_db)

        oid = ids[0]
        r = await c.patch(f"/api/orders/{oid}", json={"status": "contactado"}, headers=admin)
        check("PATCH estado", r.status_code == 200 and r.json()["status"] == "contactado", r.text)
        check("PATCH estado inválido -> 422", (await c.patch(f"/api/orders/{oid}", json={"status": "xx"}, headers=admin)).status_code == 422)
        check("PATCH con campo extra -> 422", (await c.patch(f"/api/orders/{oid}", json={"status": "nuevo", "company_name": "x"}, headers=admin)).status_code == 422)
        check("PATCH id inexistente -> 404", (await c.patch("/api/orders/99999", json={"status": "nuevo"}, headers=admin)).status_code == 404)
        check("PATCH sin permisos -> 403", (await c.patch(f"/api/orders/{oid}", json={"status": "nuevo"}, headers=user)).status_code == 403)

        r = await c.get("/api/orders?status=contactado", headers=admin)
        p = r.json()
        check("filtro por estado: total filtrado", p["total"] == 1 and all(o["status"] == "contactado" for o in p["items"]), p["total"])
        check("filtro por estado: counts siguen siendo globales", sum(p["counts"].values()) == total_in_db and p["counts"]["contactado"] == 1, p["counts"])
        r = await c.get("/api/orders?skip=2&limit=3", headers=admin)
        p = r.json()
        check("paginación skip/limit", len(p["items"]) == 3 and p["items"][0]["id"] == ids[2] and p["total"] == total_in_db, [o["id"] for o in p["items"]])
        check("limit > 100 -> 422", (await c.get("/api/orders?limit=101", headers=admin)).status_code == 422)
        check("skip negativo -> 422", (await c.get("/api/orders?skip=-1", headers=admin)).status_code == 422)

        # -------------------------------------------------------------- postulaciones
        print("\n[postulaciones]")
        limiter.reset()
        sent.clear()
        r = await c.post("/api/applications", json=APPLICATION)
        check("POST /applications público -> 201", r.status_code == 201 and r.json() == {"ok": True}, r.text)
        check("mails de postulación (admin + candidato)", len(sent) == 2 and sent[0]["Subject"] == "Nueva postulación", [m["Subject"] for m in sent])
        async with AsyncSessionLocal() as s:
            app_row = (await s.scalars(select(JobApplication))).one()
        check("teléfono/GitHub vacíos se guardan como NULL", app_row.phone is None and app_row.github_url is None)
        check("consent_at se registra", app_row.consent and app_row.consent_at is not None)
        check("status inicial = nueva", app_row.status.value == "nueva")

        limiter.reset()
        check("sin consentimiento -> 422", (await c.post("/api/applications", json={**APPLICATION, "consent": False})).status_code == 422)
        check("motivación < 30 caracteres -> 422", (await c.post("/api/applications", json={**APPLICATION, "motivation": "muy corto"})).status_code == 422)
        check("URL inválida -> 422", (await c.post("/api/applications", json={**APPLICATION, "linkedin_url": "javascript:alert(1)"})).status_code == 422)
        check("área fuera de la lista -> 422", (await c.post("/api/applications", json={**APPLICATION, "area": "Hackeo"})).status_code == 422)
        n0 = await count(JobApplication)
        r = await c.post("/api/applications", json={**APPLICATION, "website": "spam"})
        check("honeypot: 201 sin guardar", r.status_code == 201 and await count(JobApplication) == n0)
        limiter.reset()
        codes = [(await c.post("/api/applications", json=APPLICATION)).status_code for _ in range(6)]
        check("rate limit de postulaciones", codes == [201] * 5 + [429], codes)

        check("GET /applications sin token -> 401", (await c.get("/api/applications")).status_code == 401)
        check("GET /applications con USER -> 403", (await c.get("/api/applications", headers=user)).status_code == 403)
        p = (await c.get("/api/applications", headers=admin)).json()
        check("listado admin con counts (5 estados)", set(p["counts"]) == {"nueva", "en_revision", "entrevista", "descartada", "contratada"} and p["total"] == await count(JobApplication))
        aid = p["items"][0]["id"]
        r = await c.patch(f"/api/applications/{aid}", json={"status": "entrevista"}, headers=admin)
        check("PATCH estado de postulación", r.status_code == 200 and r.json()["status"] == "entrevista", r.text)
        check("PATCH 404", (await c.patch("/api/applications/9999", json={"status": "nueva"}, headers=admin)).status_code == 404)
        p = (await c.get("/api/applications?status=entrevista", headers=admin)).json()
        check("filtro por estado en postulaciones", p["total"] == 1 and p["counts"]["entrevista"] == 1)

        # ---------------------------------------------------------------- Turnstile
        print("\n[turnstile]")
        limiter.reset()
        settings.ENVIRONMENT = "production"
        settings.TURNSTILE_SECRET_KEY = None
        r = await c.post("/api/orders", headers=user, json=ORDER)
        check("producción sin secret -> falla cerrado (503)", r.status_code == 503, r.text)

        settings.TURNSTILE_SECRET_KEY = "secreto-de-prueba"
        r = await c.post("/api/orders", headers=user, json=ORDER)
        check("sin token de Turnstile -> 400", r.status_code == 400, r.text)

        cf_requests: list[str] = []

        def fake_cloudflare(success: bool):
            def handler(request: httpx.Request) -> httpx.Response:
                cf_requests.append(request.content.decode())
                return httpx.Response(200, json={"success": success, "error-codes": [] if success else ["invalid-input-response"]})
            return handler

        real_client = httpx.AsyncClient
        turnstile_mod.httpx.AsyncClient = lambda **kw: real_client(transport=httpx.MockTransport(fake_cloudflare(False)), **kw)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "turnstile_token": "token-mal"})
        check("token rechazado por Cloudflare -> 400", r.status_code == 400, r.text)
        turnstile_mod.httpx.AsyncClient = lambda **kw: real_client(transport=httpx.MockTransport(fake_cloudflare(True)), **kw)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "turnstile_token": "token-ok"})
        check("token válido -> 201", r.status_code == 201, r.text)
        check("se le manda a Cloudflare el secret, el token y la IP", "secret=secreto-de-prueba" in cf_requests[-1] and "response=token-ok" in cf_requests[-1] and "remoteip=" in cf_requests[-1], cf_requests[-1])

        def cf_down(request):
            raise httpx.ConnectError("sin red")

        turnstile_mod.httpx.AsyncClient = lambda **kw: real_client(transport=httpx.MockTransport(cf_down), **kw)
        r = await c.post("/api/orders", headers=user, json={**ORDER, "turnstile_token": "x"})
        check("Cloudflare caído -> falla cerrado (503)", r.status_code == 503, r.text)
        turnstile_mod.httpx.AsyncClient = real_client
        settings.ENVIRONMENT = "development"
        settings.TURNSTILE_SECRET_KEY = None

        # ------------------------------------------------------ partners y portfolio
        print("\n[partners y portfolio (puente con la v1)]")
        check("GET /partners es público y devuelve array", (await c.get("/api/partners")).json() == [])
        check("POST /partners sin admin -> 403", (await c.post("/api/partners", json={"name": "X", "industry": "Y"}, headers=user)).status_code == 403)
        r = await c.post("/api/partners", json={"name": "Café Uno", "industry": "Gastronomía", "logo_url": ""}, headers=admin)
        check("POST /partners (admin)", r.status_code == 201 and r.json()["logo_url"] is None, r.text)
        pid = r.json()["id"]
        check("logo_url inválido -> 422", (await c.post("/api/partners", json={"name": "X", "industry": "Y", "logo_url": "ftp://x"}, headers=admin)).status_code == 422)
        r = await c.patch(f"/api/partners/{pid}", json={"industry": "Retail"}, headers=admin)
        check("PATCH /partners parcial", r.status_code == 200 and r.json()["industry"] == "Retail" and r.json()["name"] == "Café Uno", r.text)
        check("DELETE /partners", (await c.delete(f"/api/partners/{pid}", headers=admin)).status_code == 204 and (await c.get("/api/partners")).json() == [])

        r = await c.post("/api/portfolio", json={"title": "CRM a medida", "description": "Un CRM", "status": "terminado", "client_name": "Ferretería Sur", "project_url": "https://ejemplo.com"}, headers=admin)
        check("POST /portfolio con status/client_name/project_url", r.status_code == 201 and r.json()["status"] == "terminado", r.text)
        r = await c.post("/api/portfolio", json={"title": "Otro", "description": "Sin estado"}, headers=admin)
        check("portfolio: status default = en_progreso", r.json()["status"] == "en_progreso", r.text)
        items = (await c.get("/api/portfolio")).json()
        check("GET /portfolio público con los campos de la v1", len(items) == 2 and {"status", "client_name", "project_url", "image_url"} <= set(items[0]), items)
        check("portfolio: status inválido -> 422", (await c.post("/api/portfolio", json={"title": "x", "description": "y", "status": "hecho"}, headers=admin)).status_code == 422)
        check("servicios siguen funcionando", (await c.post("/api/services", json={"title": "IA", "description": "Chatbots"}, headers=admin)).status_code == 201)
        check("tickets siguen funcionando", (await c.post("/api/tickets", json={"title": "Problema", "description": "No anda"}, headers=user)).status_code == 201)


        # ---------------------------------------------- v2.1: mis pedidos y mails de estado
        print("\n[v2.1: pedidos ligados al usuario y mail de cambio de estado]")
        async with AsyncSessionLocal() as s:
            user_id = await s.scalar(select(User.id).where(User.email == "cliente@x.com"))
            owned = await s.scalar(select(func.count()).select_from(ClientOrder).where(ClientOrder.user_id == user_id))
        check("los pedidos nuevos quedan con user_id del cliente (del token)", owned and owned == await count(ClientOrder), owned)
        mine = (await c.get("/api/orders/mine", headers=user)).json()
        check("GET /orders/mine devuelve los pedidos del usuario", len(mine) == owned and all(o["user_id"] == user_id for o in mine))
        check("GET /orders/mine sin token -> 401", (await c.get("/api/orders/mine")).status_code == 401)
        await c.post("/api/auth/register", json={"email": "otro@x.com", "password": "Clave-otro-123!"})
        other = {"Authorization": f"Bearer {(await login(c, 'otro@x.com', 'Clave-otro-123!')).json()['access_token']}"}
        check("otro usuario no ve pedidos ajenos", (await c.get("/api/orders/mine", headers=other)).json() == [])

        r = await c.get("/api/orders", headers=admin)
        check("OrderStatus incluye finalizado", "finalizado" in r.json()["counts"])
        oid2 = mine[0]["id"]
        sent.clear()
        r = await c.patch(f"/api/orders/{oid2}", json={"status": "finalizado"}, headers=admin)
        check("PATCH a finalizado", r.status_code == 200 and r.json()["status"] == "finalizado", r.text)
        check("cambio de estado manda 1 mail al dueño (no al contact_email del form)", len(sent) == 1 and sent[0]["To"] == "cliente@x.com" and "Finalizado" in sent[0]["Subject"], [dict(m) for m in sent])
        sent.clear()
        await c.patch(f"/api/orders/{oid2}", json={"status": "finalizado"}, headers=admin)
        check("mismo estado otra vez: NO manda mail", len(sent) == 0)
        email_mod._deliver = boom
        r = await c.patch(f"/api/orders/{oid2}", json={"status": "en_revision"}, headers=admin)
        check("SMTP caído: el PATCH igual responde 200", r.status_code == 200, r.text)
        email_mod._deliver = lambda msg: sent.append(msg)

        # ------------------------------------------------------ roles: técnicos (panel admin)
        print("\n[roles: promover / quitar TECHNICIAN]")
        T = "/api/team/technicians"
        check("GET técnicos con USER -> 403", (await c.get(T, headers=user)).status_code == 403)
        check("POST promover sin sesión -> 401", (await c.post(T, json={"email": "otro@x.com"})).status_code == 401)
        check("POST promover con USER -> 403", (await c.post(T, json={"email": "otro@x.com"}, headers=user)).status_code == 403)
        check("promover email inexistente -> 404", (await c.post(T, json={"email": "nadie@x.com"}, headers=admin)).status_code == 404)
        await c.post("/api/auth/register", json={"email": "admin2@x.com", "password": "Clave-admin2-1!"})
        async with AsyncSessionLocal() as s:
            await s.execute(text("update users set role = 'ADMIN' where email = 'admin2@x.com'"))
            await s.commit()
        r = await c.post(T, json={"email": "admin2@x.com"}, headers=admin)
        check("promover a un ADMIN -> 409", r.status_code == 409, (r.status_code, r.text))
        r = await c.post(T, json={"email": " OTRO@x.com "}, headers=admin)
        check("ADMIN promueve por email (case/espacios ok)", r.status_code == 201 and r.json()["role"] == "TECHNICIAN", r.text)
        tech_id = r.json()["id"]
        check("promover de nuevo -> 409", (await c.post(T, json={"email": "otro@x.com"}, headers=admin)).status_code == 409)
        tech = other  # mismo token: el rol se lee de la DB en cada request
        check("el token del usuario ya tiene rol TECHNICIAN (sin volver a loguear)", (await c.get("/api/auth/me", headers=tech)).json()["role"] == "TECHNICIAN")
        r = await c.get(T, headers=tech)
        check("TECHNICIAN puede VER la lista", r.status_code == 200 and [u["email"] for u in r.json()] == ["otro@x.com"], r.text)
        check("TECHNICIAN NO puede promover", (await c.post(T, json={"email": "cliente@x.com"}, headers=tech)).status_code == 403)
        check("TECHNICIAN NO puede quitar roles", (await c.delete(f"{T}/{tech_id}", headers=tech)).status_code == 403)

        print("\n[permisos del TECHNICIAN]")
        r = await c.get("/api/orders", headers=tech)
        check("TECHNICIAN ve pedidos", r.status_code == 200)
        check("TECHNICIAN cambia estado de pedido", (await c.patch(f"/api/orders/{oid2}", json={"status": "contactado"}, headers=tech)).status_code == 200)
        check("TECHNICIAN ve postulaciones", (await c.get("/api/applications", headers=tech)).status_code == 200)
        check("TECHNICIAN cambia estado de postulación", (await c.patch(f"/api/applications/{aid}", json={"status": "nueva"}, headers=tech)).status_code == 200)
        check("TECHNICIAN NO puede enviar a papelera un pedido", (await c.delete(f"/api/orders/{oid2}", headers=tech)).status_code == 403)
        check("TECHNICIAN NO puede enviar a papelera una postulación", (await c.delete(f"/api/applications/{aid}", headers=tech)).status_code == 403)
        check("TECHNICIAN NO ve la papelera", (await c.get("/api/trash", headers=tech)).status_code == 403)
        check("USER no puede enviar a papelera", (await c.delete(f"/api/orders/{oid2}", headers=user)).status_code == 403)

        # ------------------------------------------------------------- papelera + purga
        print("\n[papelera: soft delete, restaurar y purga a los 30 días]")
        before = (await c.get("/api/orders", headers=admin)).json()
        r = await c.delete(f"/api/orders/{oid2}", headers=admin)
        check("ADMIN envía pedido a la papelera (204)", r.status_code == 204, r.text)
        after = (await c.get("/api/orders", headers=admin)).json()
        check("sale del listado y de los contadores", after["total"] == before["total"] - 1 and oid2 not in [o["id"] for o in after["items"]] and sum(after["counts"].values()) == sum(before["counts"].values()) - 1)
        check("sale de 'Mis pedidos'", oid2 not in [o["id"] for o in (await c.get("/api/orders/mine", headers=user)).json()])
        check("PATCH sobre uno en papelera -> 404", (await c.patch(f"/api/orders/{oid2}", json={"status": "nuevo"}, headers=admin)).status_code == 404)
        check("borrarlo dos veces -> 404", (await c.delete(f"/api/orders/{oid2}", headers=admin)).status_code == 404)
        r = await c.delete(f"/api/applications/{aid}", headers=admin)
        check("ADMIN envía postulación a la papelera", r.status_code == 204)
        check("postulación fuera del listado", aid not in [a["id"] for a in (await c.get("/api/applications", headers=admin)).json()["items"]])

        r = await c.get("/api/trash", headers=admin)
        t = r.json()
        kinds = {(i["kind"], i["id"]) for i in t["items"]}
        check("GET /trash lista ambos con retention_days=30", r.status_code == 200 and t["retention_days"] == 30 and kinds == {("order", oid2), ("application", aid)}, t)
        it = next(i for i in t["items"] if i["kind"] == "order")
        check("seconds_left ≈ 30 días", 29.9 * 86400 < it["seconds_left"] <= 30 * 86400, it["seconds_left"])
        check("GET /trash con USER -> 403", (await c.get("/api/trash", headers=user)).status_code == 403)
        check("restaurar con TECHNICIAN -> 403", (await c.post(f"/api/trash/order/{oid2}/restore", headers=tech)).status_code == 403)
        r = await c.post(f"/api/trash/order/{oid2}/restore", headers=admin)
        check("ADMIN restaura el pedido", r.status_code == 204)
        check("vuelve al listado", oid2 in [o["id"] for o in (await c.get("/api/orders", headers=admin)).json()["items"]])
        check("restaurar algo que no está en la papelera -> 404", (await c.post(f"/api/trash/order/{oid2}/restore", headers=admin)).status_code == 404)
        check("kind inválido -> 422", (await c.post(f"/api/trash/foo/{oid2}/restore", headers=admin)).status_code == 422)

        # Purga: la postulación sigue en la papelera. La envejecemos 31 días y mandamos otro pedido a
        # la papelera hace 29 días: el primero debe borrarse, el segundo no.
        await c.delete(f"/api/orders/{oid2}", headers=admin)
        async with AsyncSessionLocal() as s:
            await s.execute(text("update job_applications set deleted_at = now() - interval '31 days' where id = :i"), {"i": aid})
            await s.execute(text("update client_orders set deleted_at = now() - interval '29 days' where id = :i"), {"i": oid2})
            await s.commit()
        async with AsyncSessionLocal() as s:
            removed = await crud_trash.purge_expired(s)
        check("purga: elimina lo de >30 días, conserva lo de 29", removed == 1 and kinds_after(await c.get("/api/trash", headers=admin)) == {("order", oid2)}, removed)
        async with AsyncSessionLocal() as s:
            gone = await s.get(JobApplication, aid)
        check("la postulación vencida ya no existe en la DB", gone is None)
        async with AsyncSessionLocal() as s:
            await s.execute(text("update client_orders set deleted_at = null where id = :i"), {"i": oid2})
            await s.commit()

        print("\n[APScheduler]")
        scheduler_mod.start_scheduler()
        try:
            job = scheduler_mod.scheduler.get_job(scheduler_mod.PURGE_JOB_ID)
            check("el job de limpieza queda registrado", job is not None and scheduler_mod.scheduler.running)
            check("intervalo = TRASH_PURGE_INTERVAL_MINUTES", job is not None and job.trigger.interval.total_seconds() == settings.TRASH_PURGE_INTERVAL_MINUTES * 60)
            async with AsyncSessionLocal() as s:
                await s.execute(text("update client_orders set deleted_at = now() - interval '40 days' where id = :i"), {"i": oid2})
                await s.commit()
            await scheduler_mod.purge_trash_job()  # lo que ejecuta el scheduler
            async with AsyncSessionLocal() as s:
                check("el job elimina de verdad lo vencido", await s.get(ClientOrder, oid2) is None)
        finally:
            scheduler_mod.stop_scheduler()

        print("\n[quitar rol TECHNICIAN]")
        r = await c.delete(f"{T}/{tech_id}", headers=admin)
        check("ADMIN quita el rol (vuelve a USER)", r.status_code == 200 and r.json()["role"] == "USER", r.text)
        check("la sesión abierta pierde permisos al instante", (await c.get("/api/orders", headers=tech)).status_code == 403)
        check("quitar a quien no es TECHNICIAN -> 404", (await c.delete(f"{T}/{tech_id}", headers=admin)).status_code == 404)
        check("la lista queda vacía", (await c.get(T, headers=admin)).json() == [])

        # ----------------------------------------------------------------- perfil
        print("\n[mi cuenta]")
        r = await c.patch("/api/users/me", json={"first_name": " Ana ", "last_name": "Gómez"}, headers=user)
        check("PATCH /users/me edita nombre", r.status_code == 200 and r.json()["full_name"] == "Ana Gómez", r.text)
        check("PATCH /users/me no deja cambiar el rol", (await c.patch("/api/users/me", json={"first_name": "A", "last_name": "B", "role": "ADMIN"}, headers=user)).status_code == 422)
        check("PATCH /users/me con nombre vacío -> 422", (await c.patch("/api/users/me", json={"first_name": " ", "last_name": "B"}, headers=user)).status_code == 422)

        # ------------------------------------------------------------ chat de soporte
        print("\n[chat de soporte]")
        S = "/api/support/tickets"
        limiter.reset()
        check("crear chat sin sesión -> 401", (await c.post(S, json={"title": "Hola", "message": "x"})).status_code == 401)
        check("crear chat sin título -> 422", (await c.post(S, json={"message": "hola"}, headers=user)).status_code == 422)
        check("título muy corto -> 422", (await c.post(S, json={"title": "ab", "message": "hola"}, headers=user)).status_code == 422)
        check("primer mensaje > 2000 -> 422", (await c.post(S, json={"title": "Problema", "message": "a" * 2001}, headers=user)).status_code == 422)
        check("campo extra (user_id) -> 422", (await c.post(S, json={"title": "Problema", "message": "hola", "user_id": 1}, headers=user)).status_code == 422)
        r = await c.post(S, json={"title": "No puedo entrar", "message": "a" * 2000}, headers=user)
        d = r.json()
        check("mensaje de exactamente 2000 caracteres se acepta", r.status_code == 201 and len(d["messages"][0]["content"]) == 2000, r.text[:200])
        check("el chat arranca 'abierto' y el cliente puede escribir 1 más", d["status"] == "abierto" and d["can_send"] is True and d["block_reason"] is None)
        tid = d["id"]
        r = await c.post(f"{S}/{tid}/messages", json={"content": "Segundo mensaje"}, headers=user)
        check("2.º mensaje seguido: OK pero queda bloqueado", r.status_code == 201 and r.json()["can_send"] is False and r.json()["block_reason"] == "awaiting_support", r.text[:200])
        r = await c.post(f"{S}/{tid}/messages", json={"content": "Tercero"}, headers=user)
        check("3.er mensaje seguido -> 409 (regla validada en el backend)", r.status_code == 409 and "2 mensajes seguidos" in r.json()["detail"], r.text)
        n_msgs = await count(SupportMessage)
        check("el 3.º no se guardó", n_msgs == 2, n_msgs)
        check("mensaje vacío -> 422", (await c.post(f"{S}/{tid}/messages", json={"content": "   "}, headers=user)).status_code == 422)
        check("mensaje > 2000 -> 422", (await c.post(f"{S}/{tid}/messages", json={"content": "x" * 2001}, headers=user)).status_code == 422)

        # privacidad
        stranger = {"Authorization": f"Bearer {(await login(c, 'cliente@x.com', 'Clave-cliente-1!')).json()['access_token']}"}  # mismo usuario
        await c.post("/api/auth/register", json={"email": "ajeno@x.com", "password": "Clave-ajeno-123!"})
        ajeno = {"Authorization": f"Bearer {(await login(c, 'ajeno@x.com', 'Clave-ajeno-123!')).json()['access_token']}"}
        check("otro usuario no puede leer el chat (404)", (await c.get(f"{S}/{tid}", headers=ajeno)).status_code == 404)
        check("otro usuario no puede escribir (404)", (await c.post(f"{S}/{tid}/messages", json={"content": "hola"}, headers=ajeno)).status_code == 404)
        check("USER no puede listar todos los chats (403)", (await c.get(S, headers=user)).status_code == 403)
        check("historial propio: lista por título", [t["title"] for t in (await c.get(f"{S}/mine", headers=stranger)).json()] == ["No puedo entrar"])
        check("historial de otro usuario: vacío", (await c.get(f"{S}/mine", headers=ajeno)).json() == [])

        # el equipo responde (admin y técnico)
        r = await c.get(S, headers=admin)
        p = r.json()
        check("ADMIN lista chats con counts por estado", r.status_code == 200 and set(p["counts"]) == {"abierto", "respondido", "cerrado"} and p["counts"]["abierto"] == 1 and p["total"] == 1, p["counts"])
        check("el chat trae owner y last_message_at", p["items"][0]["owner"]["email"] == "cliente@x.com" and p["items"][0]["first_response_at"] is None)
        r = await c.post(f"{S}/{tid}/messages", json={"content": "Hola, ya lo miramos."}, headers=admin)
        d = r.json()
        check("el equipo responde: estado 'respondido' y first_response_at", r.status_code == 201 and d["status"] == "respondido" and d["first_response_at"] is not None, r.text[:200])
        check("mensajes marcan from_customer correctamente", [m["from_customer"] for m in d["messages"]] == [True, True, False])
        r = await c.get(f"{S}/{tid}", headers=user)
        check("tras la respuesta del equipo el cliente puede escribir de nuevo", r.json()["can_send"] is True)
        first = r.json()["first_response_at"]
        for text_ in ("Gracias", "Sigue sin andar"):
            r = await c.post(f"{S}/{tid}/messages", json={"content": text_}, headers=user)
        check("ciclo: 2 más y se bloquea otra vez", r.status_code == 201 and r.json()["can_send"] is False and r.json()["status"] == "abierto")
        r = await c.post(f"{S}/{tid}/messages", json={"content": "x"}, headers=user)
        check("…y el siguiente es 409", r.status_code == 409)
        r = await c.post(f"{S}/{tid}/messages", json={"content": "Más info"}, headers=admin)
        r = await c.post(f"{S}/{tid}/messages", json={"content": "Otra respuesta"}, headers=admin)
        check("el equipo puede mandar varios seguidos (sin límite)", r.status_code == 201)
        check("first_response_at no se pisa", r.json()["first_response_at"] == first)

        # carrera: 2 mensajes del cliente en paralelo cuando solo le queda 1 de cupo
        await c.post(f"{S}/{tid}/messages", json={"content": "uno"}, headers=user)  # cupo 1/2 usado
        results = await asyncio.gather(*[c.post(f"{S}/{tid}/messages", json={"content": f"carrera {i}"}, headers=user) for i in range(4)])
        codes = sorted(r.status_code for r in results)
        check("concurrencia: de 4 simultáneos solo 1 pasa (FOR UPDATE)", codes == [201, 409, 409, 409], codes)

        r = await c.patch(f"{S}/{tid}", json={"status": "cerrado"}, headers=admin)
        check("el equipo puede cerrar el chat", r.status_code == 200 and r.json()["status"] == "cerrado" and r.json()["block_reason"] == "closed")
        check("PATCH de estado con USER -> 403", (await c.patch(f"{S}/{tid}", json={"status": "abierto"}, headers=user)).status_code == 403)
        check("chat cerrado: el cliente no escribe (409)", (await c.post(f"{S}/{tid}/messages", json={"content": "hola"}, headers=user)).status_code == 409)
        check("chat cerrado: ni el equipo (409)", (await c.post(f"{S}/{tid}/messages", json={"content": "hola"}, headers=admin)).status_code == 409)
        check("reabrir", (await c.patch(f"{S}/{tid}", json={"status": "respondido"}, headers=admin)).json()["status"] == "respondido")
        p = (await c.get(f"{S}?status=respondido", headers=admin)).json()
        check("filtro por estado en soporte", p["total"] == 1 and p["counts"]["cerrado"] == 0)

        async with AsyncSessionLocal() as s:
            try:
                await s.execute(text("insert into support_messages (ticket_id, sender_id, content) values (:t, :u, :c)"), {"t": tid, "u": user_id, "c": "x" * 2001})
                await s.commit()
                ck = False
            except Exception:  # noqa: BLE001
                ck = True
        check("la DB también rechaza mensajes > 2000 (CHECK)", ck)

        # ------------------------------------------------------ portfolio con galería
        print("\n[portfolio: galería multimedia]")
        gal = {"title": "Tienda online", "description": "Texto\ndescriptivo", "status": "terminado", "media": [
            {"url": "https://res.cloudinary.com/x/a.jpg", "media_type": "image", "caption": "Home"},
            {"url": "https://res.cloudinary.com/x/v.mp4", "media_type": "video"},
            {"url": "https://x.com/informe.pdf", "media_type": "file", "caption": ""}]}
        check("crear portfolio sin sesión -> 401", (await c.post("/api/portfolio", json=gal)).status_code == 401)
        check("crear portfolio con USER -> 403", (await c.post("/api/portfolio", json=gal, headers=user)).status_code == 403)
        r = await c.post("/api/portfolio", json=gal, headers=admin)
        g = r.json()
        check("crea item con 3 archivos, en orden y con position", r.status_code == 201 and [m["media_type"] for m in g["media"]] == ["image", "video", "file"] and [m["position"] for m in g["media"]] == [0, 1, 2], r.text[:300])
        check("caption vacío -> null; image_url = portada derivada", g["media"][2]["caption"] is None and g["image_url"] == "https://res.cloudinary.com/x/a.jpg")
        gid = g["id"]
        check("GET público devuelve la galería", len((await c.get(f"/api/portfolio/{gid}")).json()["media"]) == 3)
        r = await c.put(f"/api/portfolio/{gid}", json={**gal, "media": [gal["media"][2], gal["media"][0]]}, headers=admin)
        check("PUT reemplaza y reordena la galería", r.status_code == 200 and [m["media_type"] for m in r.json()["media"]] == ["file", "image"], r.text[:200])
        async with AsyncSessionLocal() as s:
            n_media = await s.scalar(text("select count(*) from portfolio_media where item_id = :i"), {"i": gid})
        check("los archivos quitados se borran de la tabla", n_media == 2, n_media)
        check("URL inválida en la galería -> 422", (await c.post("/api/portfolio", json={**gal, "media": [{"url": "javascript:alert(1)"}]}, headers=admin)).status_code == 422)
        check("tipo de archivo inválido -> 422", (await c.post("/api/portfolio", json={**gal, "media": [{"url": "https://x.com/a", "media_type": "exe"}]}, headers=admin)).status_code == 422)
        check("más de 30 archivos -> 422", (await c.post("/api/portfolio", json={**gal, "media": [{"url": "https://x.com/a"}] * 31}, headers=admin)).status_code == 422)
        r = await c.post("/api/portfolio", json={"title": "Legacy", "description": "d", "image_url": "https://x.com/old.png"}, headers=admin)
        check("compatibilidad: image_url suelto pasa a ser el 1.er archivo", r.status_code == 201 and len(r.json()["media"]) == 1 and r.json()["image_url"] == "https://x.com/old.png", r.text[:200])
        r = await c.post("/api/auth/register", json={"email": "ed@x.com", "password": "Clave-editor-1!"})
        await c.post(T, json={"email": "ed@x.com"}, headers=admin)
        editor = {"Authorization": f"Bearer {(await login(c, 'ed@x.com', 'Clave-editor-1!')).json()['access_token']}"}
        check("TECHNICIAN (editor) puede crear portfolio", (await c.post("/api/portfolio", json=gal, headers=editor)).status_code == 201)
        check("TECHNICIAN puede editar portfolio", (await c.put(f"/api/portfolio/{gid}", json=gal, headers=editor)).status_code == 200)
        check("TECHNICIAN NO puede borrar portfolio", (await c.delete(f"/api/portfolio/{gid}", headers=editor)).status_code == 403)
        check("ADMIN borra y se va la galería en cascada", (await c.delete(f"/api/portfolio/{gid}", headers=admin)).status_code == 204 and (await count_media(gid)) == 0)

        # ------------------------------------------------------------ cambio de clave
        print("\n[cambio de contraseña]")
        url = "/api/users/me/password"
        check("sin token -> 401", (await c.patch(url, json={"current_password": "a", "new_password": "Nueva-clave-123!"})).status_code == 401)
        r = await c.patch(url, json={"current_password": "equivocada", "new_password": "Nueva-clave-123!"}, headers=admin)
        check("clave actual incorrecta -> 400 (no 401)", r.status_code == 400 and "actual" in r.json()["detail"], r.text)
        for weak, why in (("clave-inicial-123", "sin mayúscula ni especial"), ("Clave-inicial", "sin número"), ("clave-inicial-1!", "sin mayúscula"), ("ClaveInicial123", "sin especial")):
            r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": weak}, headers=admin)
            check(f"nueva débil ({why}) -> 422", r.status_code == 422, r.text)
        r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": "corta"}, headers=admin)
        check("nueva muy corta -> 422", r.status_code == 422)
        r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": "ñ" * 40}, headers=admin)
        check("nueva > 72 bytes (tildes) -> 422", r.status_code == 422)
        r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": "Nueva-clave-123!"}, headers=admin)
        check("cambio exitoso -> 204", r.status_code == 204, r.text)
        check("la clave vieja ya no entra", (await login(c, "admin@ajr.test", "clave-inicial-123")).status_code == 401)
        check("la clave nueva entra", (await login(c, "admin@ajr.test", "Nueva-clave-123!")).status_code == 200)
        r = await c.patch(url, json={"current_password": "Nueva-clave-123!", "new_password": "Nueva-clave-123!"}, headers=admin)
        check("nueva igual a la actual -> 400", r.status_code == 400, r.text)
        r = await c.post("/api/auth/register", json={"email": "debil@x.com", "password": "sinmayuscula1!"})
        check("registro con clave débil -> 422", r.status_code == 422, r.text)

        # ------------------------------------------------------------ cambio de email
        print("\n[cambio de email]")
        url = "/api/users/me/email"
        good = {"current_email": "admin@ajr.test", "new_email": "Admin.Nuevo@ajr.test", "current_password": "Nueva-clave-123!"}
        check("sin token -> 401", (await c.patch(url, json=good)).status_code == 401)
        r = await c.patch(url, json={**good, "current_email": "otro@ajr.test"}, headers=admin)
        check("email actual que no coincide -> 400", r.status_code == 400, r.text)
        r = await c.patch(url, json={**good, "current_password": "equivocada"}, headers=admin)
        check("contraseña incorrecta -> 400 (no 401)", r.status_code == 400, r.text)
        r = await c.patch(url, json={**good, "new_email": "admin@ajr.test"}, headers=admin)
        check("email nuevo igual al actual -> 400", r.status_code == 400, r.text)
        r = await c.patch(url, json={**good, "new_email": "cliente@x.com"}, headers=admin)
        check("email nuevo ya registrado -> 409", r.status_code == 409, r.text)
        r = await c.patch(url, json={**good, "new_email": "no-es-un-email"}, headers=admin)
        check("email nuevo inválido -> 422", r.status_code == 422, r.text)
        r = await c.patch(url, json=good, headers=admin)
        check("cambio exitoso (se guarda en minúsculas)", r.status_code == 200 and r.json()["email"] == "admin.nuevo@ajr.test", r.text)
        check("la sesión sigue válida tras el cambio", (await c.get("/api/auth/me", headers=admin)).status_code == 200)
        check("el email viejo ya no entra", (await login(c, "admin@ajr.test", "Nueva-clave-123!")).status_code == 401)
        check("el email nuevo entra", (await login(c, "admin.nuevo@ajr.test", "Nueva-clave-123!")).status_code == 200)

        # --------------------------------------------------------- SPA y rutas /api
        print("\n[frontend estático y fallback de SPA]")
        for path in ("/", "/portfolio", "/admin/pedidos", "/trabaja-con-nosotros", "/login"):
            r = await c.get(path)
            check(f"GET {path} -> index.html (no 404)", r.status_code == 200 and "SPA-INDEX" in r.text, r.status_code)
        r = await c.get("/assets/app.js")
        check("assets servidos", r.status_code == 200 and "console.log" in r.text)
        r = await c.get("/api/no-existe")
        check("/api/no-existe -> 404 JSON (no el index)", r.status_code == 404 and r.headers["content-type"].startswith("application/json"), r.text[:80])
        r = await c.get("/api/portfolio/9999")
        check("/api/portfolio/9999 -> 404 de la API", r.status_code == 404 and "SPA-INDEX" not in r.text)
        r = await c.get("/%2e%2e/secreto.txt")
        check("path traversal bloqueado", "no deberías" not in r.text, r.text[:60])
        check("/api/docs disponible", (await c.get("/api/docs")).status_code == 200)

        # ------------------------------------- protección por IP y auditoría
        print("\n[protección por IP y auditoría]")
        settings.IP_GUARD_ENABLED = True
        settings.FLOOD_MAX_REQUESTS = 1000  # que el baneo por exceso no moleste en el bloqueo de login
        guard.reset()
        ip = "127.0.0.1"

        codes = [(await login(c, "admin@ajr.test", "mala")).status_code for _ in range(5)]
        check("4 claves malas -> 401 y la 5.ª bloquea la IP (429)", codes == [401, 401, 401, 401, 429], codes)
        r = await login(c, "admin@ajr.test", "clave-inicial-123")
        check(
            "IP bloqueada: ni con la clave correcta entra (429 + Retry-After ~30 min)",
            r.status_code == 429 and 1700 < int(r.headers.get("retry-after", 0)) <= 1800,
            (r.status_code, r.headers.get("retry-after")),
        )
        limiter.reset()
        r = await c.post("/api/auth/register", json={"email": "bloq@x.com", "password": "Clave-bloq-123!"})
        check("registro también bloqueado mientras dura el bloqueo", r.status_code == 429, r.text)
        check("el resto de la API sigue funcionando", (await c.get("/api/health")).status_code == 200)
        async with AsyncSessionLocal() as s:
            n = await s.scalar(text("select count(*) from ip_blocks where ip = :ip and kind = 'login_lock'"), {"ip": ip})
        check("el bloqueo se guarda en la base (sobrevive a reinicios)", n == 1, n)
        guard.reset()
        await guard.load_active()
        check("tras 'reiniciar' (recargar desde la base) sigue bloqueada", (await login(c, "admin@ajr.test", "clave-inicial-123")).status_code == 429)
        check("levantar el bloqueo devuelve True", await guard.release(ip) is True)
        r = await login(c, "admin@ajr.test", "clave-inicial-123")
        check("sin bloqueo vuelve a poder iniciar sesión", r.status_code == 200, r.text)
        admin = {"Authorization": f"Bearer {r.json()['access_token']}"}

        settings.FLOOD_MAX_REQUESTS = 10
        guard.reset()
        codes = [(await c.get("/api/auth/me", headers=admin)).status_code for _ in range(10)]
        check("9 pedidos pasan y el que llega al límite banea (429)", codes[:9] == [200] * 9 and codes[9] == 429, codes)
        r = await c.get("/api/auth/me", headers=admin)
        check("IP baneada: toda la API responde 429 ip_banned", r.status_code == 429 and r.json().get("code") == "ip_banned", r.text)
        check("el ban dura ~12 h", 12 * 3600 - 60 < int(r.headers["retry-after"]) <= 12 * 3600, r.headers.get("retry-after"))
        check("/api/health queda exento (health checks de Render)", (await c.get("/api/health")).status_code == 200)
        await guard.release(ip)
        settings.FLOOD_MAX_REQUESTS = 1000
        check("al levantar el ban vuelve a andar", (await c.get("/api/auth/me", headers=admin)).status_code == 200)

        # Auditoría: ADMIN y TECHNICIAN quedan registrados; un USER común, no.
        limiter.reset()
        await c.post("/api/auth/register", json={"email": "tecaudit@x.com", "password": "Clave-tec-aud-1!"})
        r = await c.post("/api/team/technicians", json={"email": "tecaudit@x.com"}, headers=admin)
        check("promover a técnico (acción auditada)", r.status_code == 201, r.text)
        logs = (await c.get("/api/audit/logs", headers=admin, params={"entity": "users", "action": "update"})).json()
        entry = next((i for i in logs["items"] if i["entity_label"] == "tecaudit@x.com"), None)
        check(
            "el cambio de rol quedó auditado: quién, qué y old -> new",
            entry is not None
            and entry["user_email"] == "admin@ajr.test"
            and entry["user_role"] == "ADMIN"
            and entry["changes"]["role"] == {"old": "USER", "new": "TECHNICIAN"}
            and entry["method"] == "POST",
            entry,
        )
        check(
            "fecha y hora en horario de Argentina",
            entry is not None
            and entry["timezone"].startswith("America/Argentina/Buenos_Aires")
            and len(entry["date_ar"]) == 10
            and len(entry["time_ar"]) == 8,
            entry,
        )
        tec_tok = (await login(c, "tecaudit@x.com", "Clave-tec-aud-1!")).json()["access_token"]
        tec = {"Authorization": f"Bearer {tec_tok}"}
        await c.patch("/api/users/me", json={"first_name": "Tec", "last_name": "Audit"}, headers=tec)
        logs = (await c.get("/api/audit/logs", headers=admin, params={"q": "tecaudit@x.com", "action": "update"})).json()
        check(
            "lo que hace un TECHNICIAN también se registra (con su rol)",
            any(i["user_email"] == "tecaudit@x.com" and i["user_role"] == "TECHNICIAN" for i in logs["items"]),
            logs,
        )
        client_id = (await c.get("/api/auth/me", headers=user)).json()["id"]
        await c.patch("/api/users/me", json={"first_name": "Lu", "last_name": "P"}, headers=user)
        logs = (await c.get("/api/audit/logs", headers=admin, params={"user_id": client_id})).json()
        check("un USER común no genera registros", logs["total"] == 0, logs)
        pw = (await c.patch("/api/users/me/password", json={"current_password": "Clave-tec-aud-1!", "new_password": "Clave-tec-aud-2!"}, headers=tec))
        logs = (await c.get("/api/audit/logs", headers=admin, params={"q": "tecaudit@x.com", "action": "update"})).json()
        pw_entries = [i for i in logs["items"] if i["changes"] and "hashed_password" in i["changes"]]
        check(
            "el cambio de contraseña se audita sin guardar el hash",
            pw.status_code == 204 and pw_entries and pw_entries[0]["changes"]["hashed_password"] == {"changed": True},
            pw_entries,
        )
        for action in ("login", "ip_locked", "ip_banned"):
            logs = (await c.get("/api/audit/logs", headers=admin, params={"action": action})).json()
            check(f"evento '{action}' registrado", logs["total"] >= 1, logs["total"])
        check("el técnico no puede ver la auditoría (403)", (await c.get("/api/audit/logs", headers=tec)).status_code == 403)
        check("un USER no puede ver la auditoría (403)", (await c.get("/api/audit/logs", headers=user)).status_code == 403)
        check("sin sesión no se ve la auditoría (401)", (await c.get("/api/audit/logs")).status_code == 401)
        check("el ADMIN lista los filtros", (await c.get("/api/audit/filters", headers=admin)).status_code == 200)
        settings.IP_GUARD_ENABLED = False

    await engine.dispose()


def kinds_after(resp) -> set:
    return {(i["kind"], i["id"]) for i in resp.json()["items"]}


async def count_media(item_id: int) -> int:
    async with AsyncSessionLocal() as s:
        return await s.scalar(text("select count(*) from portfolio_media where item_id = :i"), {"i": item_id}) or 0


async def count(model) -> int:
    async with AsyncSessionLocal() as s:
        return await s.scalar(select(func.count()).select_from(model)) or 0


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        (STATIC.parent / "secreto.txt").unlink(missing_ok=True)
        if created_static:
            shutil.rmtree(STATIC, ignore_errors=True)
    print(f"\n{PASSED} ok, {len(FAILED)} con falla")
    if FAILED:
        print("Fallaron:", *FAILED, sep="\n - ")
        sys.exit(1)
