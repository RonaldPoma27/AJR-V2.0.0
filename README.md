# AJR Data 3.5 — Hercules

**Nombre clave:** `ajrdata-3.5-hercules`  
**Base:** AJR Data 3.4 — Tanatos  
**Entrega:** Fases 1 y 2 — backend, integración frontend y rediseño global  
**Estado:** candidato de entrega funcional; requiere build con dependencias completas, QA visual real y completar datos legales antes de producción.

---

## 1. Qué incluye Hercules 3.5

Esta versión integra la base documental y técnica de Fase 1 con la interfaz global implementada en Fase 2.

- Borradores de Política de Privacidad, Términos de Uso y EULA en `docs/legal/`.
- Endpoint público `POST /api/orders/regret`, sin login, que recibe número de pedido y email de contacto.
- Verificación acotada de identidad, rate limit y respuesta genérica para datos no coincidentes.
- Código de seguimiento único y persistencia de la fecha de recepción.
- Evento de auditoría `regret_requested` dentro de la misma transacción.
- Outbox de email persistente, reintentos progresivos y despacho periódico mediante APScheduler.
- Migraciones `0009_order_regret` y `0010_email_outbox`.
- Se conserva la autenticación, permisos, endpoints y flujos del sistema anterior.
- Se preserva el layout original en contenido de negocio donde no era necesario cambiar los contratos de datos; las vistas se adaptan mediante el marco global y los estilos compartidos.

### Integración de interfaz (Fase 2)

- `AppLayout.tsx`: sidebar flotante persistente y colapsable en escritorio; drawer accesible para tablet/móvil, con cierre por Escape, control de foco, bloqueo del scroll y recuperación del foco.
- `NavBar.tsx`: barra compacta móvil con acceso visible y rotulado al botón de arrepentimiento.
- `Footer.tsx`: enlaces a Privacidad, Términos, EULA y acceso destacado al botón de arrepentimiento.
- Nuevas rutas públicas `/arrepentimiento`, `/privacy`, `/terms` y `/eula`.
- Página pública de arrepentimiento conectada a `POST /api/orders/regret`, sin login y con código de seguimiento inmediato.
- `MisPedidos.tsx`: acción contextual de solicitud y visualización del estado/código.
- `TrabajaConNosotros.tsx`: acordeones de contratación por tiempo indeterminado, plazo fijo, eventual, tiempo parcial, temporada, servicios independientes y teletrabajo.
- Renderer compartido para los documentos legales Markdown ubicados en `docs/legal/`.
- Refinamiento visual CSS-first con superficies dark premium/glass controladas, grillas responsive, estados hover/focus y respeto de `prefers-reduced-motion`.

## 2. Estado de validación y pendientes

La integración está conectada a las rutas y contratos presentes en el backend. Se validaron los JSON de traducciones y la estructura de los archivos. **No se pudo completar `npm ci` en el entorno de trabajo (la instalación quedó sin finalizar), por lo que no se pudo ejecutar `npm run build` ni certificar el type-check de TypeScript.** Tampoco se realizó QA visual en navegadores/dispositivos reales. El código debe considerarse candidato a QA, no un release certificado.

## 3. Stack y arquitectura

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, i18next y Lucide.
- **Backend:** Python, FastAPI, SQLAlchemy 2 async y Alembic.
- **Base de datos:** PostgreSQL.
- **Perímetro:** Cloudflare DNS y Cloudflare Turnstile ya integrados en formularios existentes. No se añaden capas redundantes.

## 4. Actualizar el backend

Antes de aplicar cambios en producción, generar backup de PostgreSQL y verificar las variables de entorno.

```bash
cd backend
alembic upgrade head
```

Variables esenciales:

- `DATABASE_URL`: conexión PostgreSQL compatible con `asyncpg`.
- `SECRET_KEY`: secreto único de al menos 32 caracteres.
- `SCHEDULER_ENABLED=true`: mantiene activo el worker de la outbox.
- `EMAIL_BACKEND=smtp` y `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TLS`.
- `ADMIN_NOTIFY_EMAIL` / `ADMIN_EMAIL` según la configuración existente.

`EMAIL_BACKEND=console` es exclusivamente para desarrollo: el mensaje se registra en logs y no llega al destinatario.

## 5. Endpoint de arrepentimiento

**Request:**

```http
POST /api/orders/regret
Content-Type: application/json
```

```json
{
  "order_id": 1042,
  "contact_email": "contacto@empresa.com"
}
```

**Respuesta:** HTTP `202 Accepted`, con `request_code` y `requested_at`.

La solicitud, el evento de auditoría y la fila del outbox se guardan en una única transacción. El correo se entrega de forma asíncrona con reintentos. La implementación es de entrega *at-least-once*: ante una caída después de la aceptación SMTP puede producirse un envío duplicado.

La plataforma no rechaza solicitudes por edad de `created_at`: ese campo registra la creación del pedido, no la celebración del contrato ni la entrega de un bien. La elegibilidad jurídica queda sujeta a los hitos contractuales y a las excepciones aplicables.

## 6. Marco normativo considerado

- Ley 24.240, artículo 34.
- Código Civil y Comercial, artículos 1105 a 1116.
- Disposición 954/2025: botón visible, sin registro previo, código de identificación dentro de 24 horas y medidas para efectivizar la revocación; derogó la Resolución 424/2020.
- Disposición 3/2026: mecanismos razonables de corroboración de identidad y seguridad.
- Ley 25.326 de Protección de Datos Personales.
- Ley 20.744 (LCT) y modificaciones vigentes, incluida la Ley 27.802 publicada el 6 de marzo de 2026; la UI laboral se integró en Fase 2 y muestra las modalidades con sus artículos de referencia.

Fuentes oficiales:

- [Ley 24.240 — texto actualizado](https://www.argentina.gob.ar/normativa/nacional/638/actualizacion)
- [Código Civil y Comercial — texto actualizado](https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion)
- [Disposición 954/2025 — texto](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-954-2025-417152/texto)
- [Disposición 3/2026 — texto](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-3-2026-423007/texto)
- [Ley 20.744 — texto actualizado](https://www.argentina.gob.ar/normativa/nacional/25552/actualizacion)

**Nota:** los documentos legales son borradores. Deben completarse con razón social/titular, CUIT, domicilio, emails, proveedores y plazos reales, y revisarse con asesoramiento jurídico argentino antes de publicarse. Las operaciones B2B deben evaluarse según su finalidad concreta; no se presume que todas queden automáticamente incluidas o excluidas del régimen de consumo.

## 7. Limitaciones conocidas

1. El proyecto todavía no tiene asociación estructural entre `ClientOrder` y `AgileWorkItem`; no se suspenden tareas Scrumban de forma automática.
2. El outbox hace persistente el envío y reintenta, pero la entrega dentro de 24 horas depende de SMTP, disponibilidad del worker y monitoreo externo. Los pendientes mayores a 24 horas generan un log de error que debe conectarse a alertas.
3. Aún no se registran los hitos contractuales reales y la fecha de entrega; no debe calcularse el plazo legal con `created_at`.
5. La Disposición 954/2025 también contempla un **“Botón de baja de servicio”** separado del botón de arrepentimiento para los supuestos comprendidos por el artículo 10 ter de la Ley 24.240. Esta entrega implementa el arrepentimiento solicitado; no implementa todavía un flujo de baja de servicios recurrentes. Antes de comercializar servicios continuos a distancia debe definirse su alcance y su proceso independiente.
6. La información legal y laboral es informativa. No reemplaza revisión por un profesional argentino ni la evaluación concreta de cada operación o relación laboral.

## 8. Calidad y validación

La implementación utiliza como guía los factores de McCall: corrección, confiabilidad, eficiencia, integridad y usabilidad; mantenibilidad, flexibilidad y testeabilidad; portabilidad, reusabilidad e interoperabilidad. Esto no equivale a certificación formal.

Validaciones realizadas hasta esta entrega:

- Backend: 7 pruebas focalizadas del esquema de solicitud/recibo y política de reintentos aprobadas (`pytest tests/test_order_regret_schema.py tests/test_email_outbox.py`); compilación sintáctica de módulos Python.
- Frontend: 20 JSON de traducciones parseados correctamente; revisión de rutas, esquema HTTP y correspondencia con `POST /api/orders/regret`; comprobación sintáctica de 82 archivos TypeScript/TSX mediante el transpilador de TypeScript (sin type-check por dependencias incompletas).
- No se ejecutó el build completo de frontend por la instalación incompleta de paquetes (`npm ci` se agotó por timeout).
- Las pruebas pytest generales deben ejecutarse con las dependencias del proyecto instaladas y una base de pruebas aislada. `tests/smoke_test.py` aborta intencionalmente si la URL de DB no contiene `test`; no apuntar pruebas a producción.

## 9. Comandos de QA local

```bash
cd frontend
npm ci
npm run build
npm run lint
```

Para validar backend, crear una base PostgreSQL exclusiva de pruebas, instalar las dependencias del backend y ejecutar las pruebas pertinentes según `backend/pytest.ini` y la configuración del proyecto. No ejecutar `smoke_test.py` contra producción.

---

**Identificador de entrega:** `ajrdata-3.5-hercules` · **Fases 1 y 2 integradas**
