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
from app.core.rate_limit import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ClientOrder, JobApplication  # noqa: E402

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
                "TRUNCATE users, client_orders, job_applications, partners, portfolio_items "
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
        await c.post("/api/auth/register", json={"email": "cliente@x.com", "password": "clave-cliente-1"})
        user_tok = (await login(c, "cliente@x.com", "clave-cliente-1")).json()["access_token"]
        user = {"Authorization": f"Bearer {user_tok}"}

        # ---------------------------------------------------------------- pedidos
        print("\n[pedidos]")
        limiter.reset()
        sent.clear()
        r = await c.post("/api/orders", json=ORDER)
        check("POST /orders público -> 201 Receipt", r.status_code == 201 and r.json() == {"ok": True}, r.text)
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
        r = await c.post("/api/orders", json={**ORDER, "company_name": "Con SMTP roto"})
        check("si falla el SMTP la respuesta sigue siendo 201", r.status_code == 201, r.text)
        email_mod._deliver = lambda msg: sent.append(msg)

        # Inyección de headers en el nombre no rompe ni se cuela
        sent.clear()
        r = await c.post("/api/orders", json={**ORDER, "contact_name": "Ana\r\nBcc: robo@x.com", "company_name": "Inyección"})
        check("nombre con \\r\\n aceptado y sanitizado", r.status_code == 201 and all("Bcc" not in m.keys() for m in sent), r.text)

        before = await count(ClientOrder)
        r = await c.post("/api/orders", json={**ORDER, "website": "http://spam.com"})
        check("honeypot lleno: 201 pero no guarda", r.status_code == 201 and await count(ClientOrder) == before)
        r = await c.post("/api/orders", json={**ORDER, "contact_email": "no-es-email"})
        check("email inválido -> 422", r.status_code == 422)
        r = await c.post("/api/orders", json={**ORDER, "problem_description": "corto"})
        check("descripción muy corta -> 422", r.status_code == 422)
        r = await c.post("/api/orders", json={**ORDER, "contact_phone": "abc"})
        check("teléfono inválido -> 422", r.status_code == 422)
        r = await c.post("/api/orders", json={**ORDER, "contact_phone": ""})
        check("teléfono vacío se acepta (opcional)", r.status_code == 201, r.text)

        limiter.reset()
        codes = [(await c.post("/api/orders", json=ORDER)).status_code for _ in range(7)]
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
        check("counts incluye todos los estados", set(page["counts"]) == {"nuevo", "en_revision", "contactado", "descartado"}, page["counts"])
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
        r = await c.post("/api/orders", json=ORDER)
        check("producción sin secret -> falla cerrado (503)", r.status_code == 503, r.text)

        settings.TURNSTILE_SECRET_KEY = "secreto-de-prueba"
        r = await c.post("/api/orders", json=ORDER)
        check("sin token de Turnstile -> 400", r.status_code == 400, r.text)

        cf_requests: list[str] = []

        def fake_cloudflare(success: bool):
            def handler(request: httpx.Request) -> httpx.Response:
                cf_requests.append(request.content.decode())
                return httpx.Response(200, json={"success": success, "error-codes": [] if success else ["invalid-input-response"]})
            return handler

        real_client = httpx.AsyncClient
        turnstile_mod.httpx.AsyncClient = lambda **kw: real_client(transport=httpx.MockTransport(fake_cloudflare(False)), **kw)
        r = await c.post("/api/orders", json={**ORDER, "turnstile_token": "token-mal"})
        check("token rechazado por Cloudflare -> 400", r.status_code == 400, r.text)
        turnstile_mod.httpx.AsyncClient = lambda **kw: real_client(transport=httpx.MockTransport(fake_cloudflare(True)), **kw)
        r = await c.post("/api/orders", json={**ORDER, "turnstile_token": "token-ok"})
        check("token válido -> 201", r.status_code == 201, r.text)
        check("se le manda a Cloudflare el secret, el token y la IP", "secret=secreto-de-prueba" in cf_requests[-1] and "response=token-ok" in cf_requests[-1] and "remoteip=" in cf_requests[-1], cf_requests[-1])

        def cf_down(request):
            raise httpx.ConnectError("sin red")

        turnstile_mod.httpx.AsyncClient = lambda **kw: real_client(transport=httpx.MockTransport(cf_down), **kw)
        r = await c.post("/api/orders", json={**ORDER, "turnstile_token": "x"})
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

        # ------------------------------------------------------------ cambio de clave
        print("\n[cambio de contraseña]")
        url = "/api/users/me/password"
        check("sin token -> 401", (await c.patch(url, json={"current_password": "a", "new_password": "nueva-clave-123"})).status_code == 401)
        r = await c.patch(url, json={"current_password": "equivocada", "new_password": "nueva-clave-123"}, headers=admin)
        check("clave actual incorrecta -> 400 (no 401)", r.status_code == 400 and "actual" in r.json()["detail"], r.text)
        r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": "clave-inicial-123"}, headers=admin)
        check("nueva igual a la actual -> 400", r.status_code == 400, r.text)
        r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": "corta"}, headers=admin)
        check("nueva muy corta -> 422", r.status_code == 422)
        r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": "ñ" * 40}, headers=admin)
        check("nueva > 72 bytes (tildes) -> 422", r.status_code == 422)
        r = await c.patch(url, json={"current_password": "clave-inicial-123", "new_password": "nueva-clave-123"}, headers=admin)
        check("cambio exitoso -> 204", r.status_code == 204, r.text)
        check("la clave vieja ya no entra", (await login(c, "admin@ajr.test", "clave-inicial-123")).status_code == 401)
        check("la clave nueva entra", (await login(c, "admin@ajr.test", "nueva-clave-123")).status_code == 200)

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

    await engine.dispose()


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
