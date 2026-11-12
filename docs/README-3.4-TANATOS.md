# Actualización 3.3 MORPHEO sobre REA

Módulo ágil integrado de forma selectiva. Ver [guía, pruebas y despliegue](docs/MORPHEO.md) y [archivos cambiados](docs/MORPHEO_FILES.md). Se conservan las instrucciones originales de REA debajo.

# AJR DATA — `ajrdata-v3.2-rea`

Plataforma de una consultora de software para PyMEs: sitio público, portfolio, cuentas,
pedidos, postulaciones, soporte y administración. Esta entrega agrega **correo electrónico
de respaldo verificado**, sobre la base visual Laniakea 3.1. El identificador de versión
es exactamente **`ajrdata-v3.2-rea`**, también publicado en OpenAPI.

## Cambios implementados

- Sección **Seguridad de la cuenta** en `/cuenta/seguridad`, accesible desde el menú de cuenta
  para USER, TECHNICIAN y ADMIN. Formularios separados, estados de carga/error/éxito,
  confirmación de eliminación, fecha de verificación, estado persistido y traducciones ES/EN.
- Alta, consulta, verificación, reenvío, cambio y eliminación del correo de respaldo.
  El principal no se modifica. Durante un cambio, el respaldo anterior permanece activo.
- Reautenticación con contraseña para solicitar, reenviar y eliminar; JWT para todas las rutas.
- Códigos de seis dígitos con `secrets`, HMAC-SHA256 contextualizado por usuario, dirección,
  propósito y nonce, comparación constante, vencimiento, intentos y reenvío limitado.
- Cuotas por usuario, destino e IP almacenadas en PostgreSQL, compartidas entre workers.
  Los errores de contraseña y los fallos SMTP también consumen sus cuotas correspondientes.
- SMTP estricto para seguridad: sin fallback a consola, sin códigos en logs/respuestas,
  sin devolver éxito si el envío del desafío falla. Aviso al principal tras verificar/eliminar.
- Modelos, schemas, CRUD, servicio y router separados; migración incremental `0006_backup_email`.
- Unicidad de direcciones coordinada con el registro y el cambio de correo principal.
- Auditoría de eventos de respaldo para todos los roles, sin direcciones, códigos o hashes.
- Limpieza periódica y comando manual de retención. Borrado en cascada al eliminar una cuenta.
- Uvicorn acepta cabeceras de proxy únicamente de las IP configuradas, no de cualquier origen.
- Correcciones de soporte detectadas al validar: carga explícita de los nombres de remitentes
  al cerrar/reabrir chats; ajustes de fixtures del smoke test a direcciones válidas y a la
  contraseña/correo ya cambiados durante el propio test. Sus tiempos se comparan con la configuración real.
- `package-lock.json` sincronizado; ESLint configurado; cuatro traducciones faltantes del
  componente de tema heredado completadas; `.gitignore` corregido para no ocultar código de `lib/`
  ni traducciones de `parts/`; pruebas de integración y navegador incorporadas.

**No se modificaron `DashboardCharts.tsx`, las métricas ni los cálculos de ingresos.**
Los gráficos existentes continúan mostrando sus estimaciones, no cobros confirmados.

## Qué está disponible y qué no

Una cuenta tiene como máximo un respaldo verificado y una propuesta pendiente. Las cuentas
existentes arrancan sin respaldo; no hay migración ni reinterpretación de su correo principal.
La eliminación es voluntaria, incluso si deja a la cuenta sin respaldo, con advertencia y contraseña.
Eliminar también cancela cualquier verificación pendiente; no elimina la cuenta.

**No hay recuperación de contraseña mediante el respaldo en esta versión. Tampoco se agregó MFA.**
La base recibida no tenía MFA ni recuperación de contraseña. Verificar un correo no inicia sesión,
no cambia contraseñas, no desactiva controles y no autoriza otros usuarios. El modelo `BackupEmail`
contiene únicamente direcciones verificadas y queda separado de los desafíos para una integración
futura que requerirá su propio diseño y pruebas. La API informa `recovery_available: false`.

## Arquitectura y funcionalidades conservadas

| Capa | Tecnología / organización |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind, React Router, TanStack Query, Axios e i18next |
| Backend | FastAPI, Pydantic, SQLAlchemy 2 async, asyncpg y Alembic |
| Persistencia | PostgreSQL; los bloqueos y las cuotas nuevos requieren PostgreSQL |
| Despliegue | Docker multietapa; FastAPI sirve frontend compilado y `/api` |

Se conservan el diseño Dark Tech, inicio, portfolio multimedia, solicitud de proyectos,
postulaciones, perfil, cambios de correo/contraseña, pedidos, chat de soporte, gestión del equipo,
papelera, auditoría y permisos de los roles USER/TECHNICIAN/ADMIN. La documentación histórica
completa de diseño, funcionalidades y ramas está en [HISTORIAL_LANIAKEA_3.1.md](docs/HISTORIAL_LANIAKEA_3.1.md).

Código ejecutable: `frontend/src/` y `backend/app/`. Los archivos sueltos de frontend de la raíz
se conservan por compatibilidad del paquete original, pero Vite compila `frontend/`.

## Rutas y contrato

Ruta nueva de frontend: **`/cuenta/seguridad`**. Se mantienen `/cuenta`, `/cuenta/pedidos`,
`/cuenta/soporte`, las rutas públicas y `/admin/*`.

Todos los endpoints siguientes exigen `Authorization: Bearer …`. No aceptan `user_id` en sus
cuerpos; la identidad proviene exclusivamente del JWT y se vuelve a consultar en la base.
OpenAPI: `/api/docs` y `/api/openapi.json`.

| Método y ruta | Cuerpo JSON | Resultado |
|---|---|---|
| GET `/api/security/backup-email` | Sin cuerpo | Estado propio |
| POST `/api/security/backup-email/request` | `email`, `current_password`, `language` opcional (`es`/`en`) | Envía desafío de alta/cambio |
| POST `/api/security/backup-email/verify` | `code` (string de seis dígitos), `language` opcional | Activa el correo y consume el desafío |
| POST `/api/security/backup-email/resend` | `current_password`, `language` opcional | Sustituye el código pendiente si SMTP acepta el nuevo |
| DELETE `/api/security/backup-email` | `current_password`, `language` opcional | Elimina activo y pendiente |

Las respuestas de éxito son HTTP 200 y usan `BackupEmailState`: `status` (`not_configured`,
`pending`, `verified`), `email`, `verified_at`, `pending_email`, `expires_at`,
`resend_available_at`, `attempts_remaining`, `challenge_expired`, `recovery_available` y
`notification_sent`. Los campos no aplicables son nulos. Si hay un respaldo vigente y un
cambio pendiente, `status` sigue siendo `verified` y `pending_email` describe la propuesta.
`notification_sent` es nulo cuando no corresponde un aviso; `false` significa que el cambio
se guardó pero el aviso al principal falló. La interfaz muestra esa diferencia.

| HTTP | Situación / códigos `detail` |
|---|---|
| 400 | `backup_code_invalid`, `backup_code_expired` |
| 401 | Falta de sesión, token inválido o cuenta inexistente |
| 403 | `backup_password_incorrect` (no cierra la sesión por error de contraseña) |
| 409 | `backup_address_unavailable`, `backup_no_challenge` |
| 422 | `backup_invalid_input`; no incluye valores recibidos ni secretos |
| 429 | `backup_cooldown`, `backup_rate_limited`, `backup_attempts_exhausted` |
| 503 | `backup_mail_unavailable`; el estado anterior se conserva |

Cooldown/cuotas añaden `Retry-After`; con intentos agotados hay que solicitar otro código
cuando lo permitan las cuotas. También pueden actuar los bloqueos globales por IP ya existentes.
El mensaje de dirección no revela qué cuenta la usa. Solo se devuelven direcciones de la propia cuenta.
El registro `/api/auth/register` y PATCH `/api/users/me/email` ahora también rechazan usar
una dirección ya verificada como respaldo (409); el frontend traduce ese conflicto.

## Datos, concurrencia y retención

Migración: `0005_order_plan_fields` → **`0006_backup_email`**. No se editaron revisiones previas.

- `backup_emails`: PK/FK `user_id`, dirección única y `verified_at`.
- `backup_email_challenges`: PK/FK `user_id`, destino, propósito, nonce, HMAC,
  vencimiento, fecha de envío e intentos con CHECK no negativo. Solo un desafío por usuario.
- `backup_email_rate_events`: claves HMAC de ámbito y fecha; índices para contar la ventana móvil.

Las FK de activo/desafío usan ON DELETE CASCADE. Las cuotas no tienen direcciones ni IP en claro;
se retienen por dos horas y no se eliminan inmediatamente al borrar una cuenta para evitar
reiniciar límites de destino/IP. Los desafíos se eliminan al verificar o borrar; un reenvío
sustituye el anterior. Los vencidos se purgan cuando llevan más de 24 horas vencidos.

El job existente de limpieza también purga estas tablas. Con `SCHEDULER_ENABLED=false`, ejecutar
periódicamente `python -m app.scripts.purge_backup_email`. La retención indicada depende de esa
limpieza; el vencimiento y las cuotas se aplican aunque el job esté apagado.

La política de normalización sigue al sistema: validación EmailStr y minúsculas, sin quitar
puntos ni etiquetas `+`. No se admite un principal existente ni un respaldo activo de otra cuenta.
Los pendientes **no reservan** direcciones: varias cuentas pueden proponer el mismo destino,
pero solo una puede verificarlo. Se revalida al confirmar. El registro principal también puede
ocupar una dirección antes de verificarla.

Locks de fila por usuario serializan mutaciones, y advisory locks por dirección coordinan
registro/cambio principal con verificación. El intercambio del respaldo y el consumo del desafío
se confirman en una transacción. Las cuotas usan advisory locks propios y commits independientes
del éxito del envío. Estos controles son compartidos por procesos y conexiones. Las escrituras
manuales por SQL deben respetar la política de unicidad entre tablas; los caminos de la aplicación
sí la coordinan.

## Configuración

Copiar `.env.example` a `.env` para Docker o a `backend/.env` para ejecución local. Nunca versionar
credenciales. Configurar `DATABASE_URL` y una `SECRET_KEY` aleatoria de al menos 32 caracteres.
La misma clave firma JWT y deriva HMAC con contextos separados. Rotarla invalida sesiones y desafíos
pendientes y reinicia las claves de cuotas; los correos ya verificados permanecen.

| Variable nueva | Valor inicial | Uso |
|---|---|---|
| `BACKUP_CODE_TTL_SECONDS` | 600 | Vigencia; rango 60–1800 segundos |
| `BACKUP_MAX_ATTEMPTS` | 5 | Intentos por desafío; rango 1–10 |
| `BACKUP_RESEND_SECONDS` | 60 | Espera mínima entre solicitudes/reenvíos |
| `BACKUP_MAX_OPERATIONS_USER` | 30 | Mutaciones por cuenta por hora, incluidos errores de contraseña |
| `BACKUP_MAX_OPERATIONS_IP` | 120 | Mutaciones por IP por hora |
| `BACKUP_MAX_SENDS_USER` | 5 | Solicitudes de envío por cuenta por hora |
| `BACKUP_MAX_SENDS_IP` | 20 | Solicitudes de envío por IP por hora |
| `BACKUP_MAX_SENDS_DESTINATION` | 5 | Solicitudes de envío por destino por hora, entre todas las cuentas |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Proxies confiables para Uvicorn en `prestart.sh` |

Las cuotas son ventanas móviles de una hora. Envíos fallidos consumen cuota. Un reenvío crea un
nuevo desafío con intentos nuevos, sujeto a las cuotas anteriores. Todas las instancias deben
compartir configuración, reloj sincronizado, base y secreto. No configures comodín `*` para
proxies salvo una red realmente aislada que impida acceso directo: un cliente no debe poder
falsificar su IP con `X-Forwarded-For`. Si falta configurar el proxy legítimo, varios usuarios
pueden compartir la cuota de la IP del proxy.

Se mantienen `ENVIRONMENT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`,
`ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY`,
`ADMIN_NOTIFY_EMAIL`, `TRASH_RETENTION_DAYS`, `TRASH_PURGE_INTERVAL_MINUTES`, `SCHEDULER_ENABLED`,
`RATE_LIMIT_PER_HOUR` y las variables `IP_GUARD_*`, `LOGIN_*`, `FLOOD_*` de `.env.example`.

### SMTP en desarrollo y producción

Ejemplo de nombres y valores **ficticios**, sin credenciales:

```dotenv
EMAIL_BACKEND=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=noreply@example.com
SMTP_TLS=starttls
PUBLIC_BASE_URL=https://example.com
```

Cargar `SMTP_USER` y `SMTP_PASSWORD` reales solo en el entorno del servidor si el proveedor
requiere autenticación. El remitente debe estar autorizado por ese proveedor. Alternativamente,
usar `SMTP_TLS=ssl` y el puerto de TLS implícito del proveedor, usualmente 465.

- En producción, `ENVIRONMENT=production` y sitio/API exclusivamente bajo HTTPS con certificado
  válido y TLS terminado en el proxy/hosting. El transporte de seguridad rechaza SMTP sin TLS.
- En desarrollo puede usarse un receptor SMTP local con `SMTP_TLS=none`. Leer allí los códigos;
  no se imprimen en logs de la aplicación. Las pruebas levantan un receptor local en memoria.
- `EMAIL_BACKEND=console` y SMTP ausente **no sirven para verificar respaldos**: las solicitudes
  responden 503. El fallback histórico de correos de pedidos/postulaciones se conserva y no se
  utiliza para seguridad; no usar consola con datos personales reales.
- Los correos de seguridad no incluyen enlaces. `PUBLIC_BASE_URL` sigue siendo configuración
  confiable para los enlaces existentes de pedidos; en producción usar una URL HTTPS propia.

Aceptar el mensaje por SMTP no garantiza entrega en bandeja: puede haber spam, rebotes posteriores
o restricciones de red del hosting. No se requiere un servicio pago. Esta entrega probó SMTP local;
la entrega con tu proveedor, TLS y remitente reales requiere verificación tras configurar el entorno.

## Instalación y actualización

1. Respaldar la base y comprobar `alembic current`. La revisión anterior esperada es
   `0005_order_plan_fields`; `upgrade head` también admite instalaciones nuevas desde cero.
2. Instalar dependencias y aplicar migraciones **antes** de habilitar el nuevo backend:

   ```bash
   cd backend
   python -m venv .venv
   # Activar: source .venv/bin/activate (Linux/macOS)
   # Windows PowerShell: .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   alembic upgrade head
   python -m app.scripts.create_admin
   uvicorn app.main:app --reload
   ```

3. Compilar o iniciar el frontend:

   ```bash
   cd frontend
   npm ci
   npm run build
   # Desarrollo: npm run dev (proxy /api hacia localhost:8000)
   ```

4. Configurar SMTP y proxies confiables; entrar a `/cuenta/seguridad`, agregar una dirección
   propia, verificarla y comprobar el aviso al principal. Confirmar que el login principal sigue igual.

Con Docker: `cp .env.example .env`, completar las variables y ejecutar `docker compose up --build`.
PowerShell: `Copy-Item .env.example .env`. El sitio queda en `http://localhost:8000` en desarrollo.
`prestart.sh` aplica migraciones y crea el admin si están definidas sus variables.

En Render conservar runtime Docker, contexto raíz, `./Dockerfile` y health check `/api/health`.
Configurar allí las variables, incluida la lista de proxies legítimos; el frontend se compila y
FastAPI lo sirve desde el mismo origen. No se desplegó ni se cambió tu servicio remoto desde esta entrega.

No hacer downgrade con la aplicación nueva sirviendo tráfico: `downgrade 0005_order_plan_fields`
elimina las tres tablas nuevas y sus datos. Las cuentas principales se conservan. Para revertir,
coordinar aplicación y esquema y restaurar el respaldo si se necesitan los datos de seguridad.

## Pruebas y verificación

Los tests de backend **borran datos de la base indicada**: usar una PostgreSQL descartable cuyo
nombre contenga `test`, nunca la base de desarrollo con datos importantes ni producción.
Configurar `DATABASE_URL` y `SECRET_KEY` mediante entorno. Los navegadores usan usuarios de ejemplo
y una contraseña aleatoria, no credenciales personales.

```bash
# En backend/, con base de pruebas y variables configuradas:
pip install -r requirements-dev.txt
alembic upgrade head
python -m pytest tests/test_backup_email.py -q
python -m tests.smoke_test
python -m tests.migration_test

# En frontend/:
npm ci
npm run lint
python check_i18n.py
npm run build
npx playwright install chromium --only-shell

# Volver a backend/; usa puertos locales libres 8000, 5173 y 2525:
python -m tests.browser_test
```

`test_backup_email.py` prueba permisos, aislamiento, validación, códigos, cuotas persistentes,
SMTP fallido, retención, auditoría sin secretos y carreras entre operaciones/registro.
`browser_test.py` inicia API y SMTP locales y ejecuta Playwright con Vite: escritorio ES y móvil EN,
contraseña errónea, alta, reenvío, verificación, cambio, persistencia, eliminación y ruta de cuenta.
No sustituye la API por respuestas simuladas.

Resultados reales y archivos afectados: [VALIDACION.md](docs/VALIDACION.md).

## Límites y próximos trabajos

- Sin recuperación de contraseña por respaldo y sin MFA, explícitamente fuera de esta entrega.
- SMTP y PostgreSQL no comparten transacción distribuida: si SMTP acepta y luego falla el commit
  o se interrumpe la conexión, puede llegar un código que no quedó persistido. No se pierde el
  respaldo anterior; consultar estado y solicitar otro código. Los errores de red de la UI
  conservan los campos y refrescan el estado, sin declarar éxito anticipadamente.
- Los avisos al principal son best-effort tras confirmar el cambio. El fallo se informa en UI;
  todavía no existe una cola durable de reintentos ni seguimiento de rebotes.
- Los bloqueos globales heredados mantienen su implementación; las nuevas cuotas de respaldo
  son persistentes y compartidas. La correcta atribución de IP depende del proxy configurado.
- El build mantiene una advertencia de tamaño del bundle; no se reescribió la estructura del
  frontend ni se optimizaron gráficos como parte de esta entrega.
