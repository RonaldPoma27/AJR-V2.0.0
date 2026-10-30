# AJR DATA 3.3 MORPHEO — integración selectiva sobre REA

Entrega: 29 de octubre de 2026. Base: `AJR-DATA-ajrdata-v3.2-rea (1).zip`.
Referencia inspeccionada: `AJR-V2.0.0-ajrdata-3.3-morpheo.zip`.

## Resultado y preservación

La sección `/admin/proyectos-agiles` incorpora proyectos, miembros, épicas/HU/tareas, backlog ordenable, tablero, sprints, cronología, comentarios, historial, configuración e importación. Se agregaron exclusivamente las piezas ágiles del ZIP de referencia; no se sustituyeron carpetas completas.

Se conservaron los endpoints, servicios, modelos, esquemas y pantallas de correo de respaldo de REA, su migración `0006_backup_email`, autenticación, sesiones, configuración de correo y Turnstile. No se agregó 2FA ni otro proveedor de mensajería. Las páginas públicas y sus estilos originales se mantienen. El módulo carga por separado con React.lazy.

**Diferencia del prompt con la base:** `frontend/tailwind.config.js` y `src/index.css` declaran que el tema claro fue eliminado y el producto es oscuro permanente; el `ThemeProvider` existente no se monta. Se preservó esa decisión. No se afirma compatibilidad visual probada con un modo claro inexistente. La web pública no pudo consultarse con el servicio de navegación; se usaron los tokens y componentes reales del ZIP.

## Acceso y permisos

Solo cuentas globales ADMIN/TECHNICIAN acceden a esta sección. Todo miembro debe ser una cuenta de ese equipo; los clientes USER no acceden. Un técnico puede crear un proyecto y queda como SM. ADMIN tiene acceso global; los técnicos solo ven sus proyectos. El propietario no tiene un bypass oculto de membresía.

| Acción | ADMIN | SM | PO | Developer | Observador |
|---|---|---|---|---|---|
| Consultar proyecto y actividad | Sí | Sí | Sí | Sí | Sí |
| Configurar, archivar, gestionar equipo | Sí | Sí | Sí | No | No |
| Crear/priorizar/asignar/importar elementos | Sí | Sí | Sí | No | No |
| Gestionar sprints y cierre | Sí | Sí | Sí | No | No |
| Editar cualquier tarjeta | Sí | Sí | Sí | No | No |
| Estado/descripción de tarjeta propia | Sí | Sí | Sí | Sí | No |
| Comentar | Sí | Sí | Sí | Sí | No |

Archivado: lectura para miembros; ADMIN puede restaurar o administrar. No hay endpoint de borrado físico de proyectos/sprints. No se permite cambiar el tipo de una épica que tiene hijos ni archivarla con hijos activos. No se puede eliminar el último SM propio ni degradar el último SM por cambio de rol. Las relaciones se validan en el servidor, incluyendo proyecto, responsable y sprint.

## Flujo de trabajo

Crear proyecto → incorporar equipo → crear épicas y HU → priorizar backlog → crear sprint → asignar tarjetas → iniciar sprint → actualizar tablero → revisar cierre.

El tablero usa estados predefinidos centralizados: TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED. Las épicas tienen vista propia. Hay drag-and-drop y controles de estado/orden utilizables con teclado; no se implementan límites WIP ni un editor de columnas. Los filtros y formularios conservan contexto durante la edición. El desplazamiento horizontal del tablero y de la escala temporal queda dentro de sus contenedores.

Los sprints duran exactamente 7, 14, 21 o 28 días, contando ambas fechas. Se pueden editar o extender antes del cierre. Solo uno puede estar activo por proyecto. La revisión del cierre permite seleccionar un sprint planificado que comience después del final del actual y las tarjetas pendientes a trasladar. Las no seleccionadas vuelven al backlog. Las completadas conservan su resultado histórico. Se mantienen IDs, comentarios, estimaciones, asignaciones y relaciones; no se clonan tarjetas. Las estimaciones del sprint cerrado quedan congeladas en la tabla histórica.

Todas las escrituras ágiles adquieren un bloqueo de fila del proyecto hasta el commit. Hay índice único parcial para un sprint activo, restricciones de duración y nombre y control de versión de tarjetas mediante `expected_updated_at` (enviado por la UI). Un conflicto devuelve 409 y no se muestra un resultado optimista falso. El control de versión es opcional para clientes API directos; conviene enviarlo siempre. Los bloqueos concurrentes requieren validación adicional en PostgreSQL real.

## Importación

Formatos: CSV UTF-8/UTF-8 BOM (se detecta coma, punto y coma o tabulación) y XLSX sin macros. Máximo: 5 MiB de entrada, 2000 filas, 100 columnas, 25 MiB descomprimidos para XLSX y 200 entradas ZIP. Se rechazan fórmulas. No se evalúan celdas ni se crean cuentas.

1. Elegir archivo o enlace de Google Sheets.
2. **Leer encabezados y mapear columnas**; se muestran encabezados reales. Se puede dejar la detección automática por alias ES/EN.
3. Previsualizar y validar. Revisar errores por fila, nuevos y duplicados.
4. Confirmar o cancelar. Si hay errores no se inserta ninguna fila.

La confirmación vuelve a validar y compara un digest de los datos normalizados y de las tarjetas existentes con la vista previa. Si cambia la fuente o el proyecto hay que repetirla. La importación es una transacción; el mismo bloqueo serializa cierres/importaciones. Los duplicados se identifican por **tipo + título exacto sin distinguir mayúsculas**: omitir o actualizar. Se rechazan referencias ambiguas. Las épicas se crean primero; una HU puede referenciarlas por título o clave. Las columnas vacías de responsable, épica o sprint no borran asignaciones existentes en modo actualizar; los campos de texto y estado usan los valores/defaults de la hoja.

La plantilla está en `frontend/public/agile-template.csv`, descargable desde la sección. Ejemplo:

```csv
title,type,description,epic,priority,status,points,assigned_role,assignee_email,sprint,acceptance_criteria,due_date
Acceso,EPIC,Funciones de acceso,,HIGH,TODO,,,,,,
Iniciar sesión,STORY,"Como usuario quiero acceder para consultar mis pedidos",Acceso,HIGH,TODO,3,DEVELOPER,,,Validar credenciales,
```

Campos de mapeo: `title`, `type`, `description`, `epic`, `priority`, `status`, `points`, `assigned_role`, `assignee_email`, `sprint`, `acceptance_criteria`, `due_date`. Tipos: EPIC/STORY/TASK/BUG/SUBTASK. Prioridad: LOW/MEDIUM/HIGH/URGENT. Puntos: entero 0–1000. Fecha: AAAA-MM-DD preferida; se admite DD/MM/AAAA. Sprint por nombre, responsable por correo de un miembro existente.

**Google Sheets:** exportación CSV de un enlace `https://docs.google.com/spreadsheets/d/ID/edit#gid=0` accesible públicamente/por enlace sin autenticación. No hay OAuth, credenciales de Google ni acceso a hojas privadas. Se restringen destino, redirecciones, tiempo y bytes. Si la exportación no es accesible, descargar CSV/XLSX e importarlo. No se probó una descarga real desde Google en esta entrega. Algunos diagnósticos del backend y errores de importación conservan los mensajes españoles de la referencia; las pantallas y sus claves de interfaz están en ES/EN.

## Persistencia y API

Migración nueva `0007_agile_projects`, dependiente de la **0006 de REA sin modificaciones**. Tablas: agile_projects, agile_memberships, agile_sprints, agile_work_items, agile_sprint_items, agile_work_item_history, agile_work_item_comments. No se modifican tablas anteriores. Las cascadas se limitan a entidades internas del módulo; no se exponen borrados físicos. El downgrade elimina exclusivamente tablas ágiles y, por tanto, sus datos.

Base de endpoints: `/api/agile` (contratos detallados en `/api/docs`).

| Recurso | Operaciones |
|---|---|
| `/projects` | GET paginado, POST |
| `/projects/{id}` | GET, PATCH (incluye archivo/restauración) |
| `/projects/{id}/members` | GET, POST (alta/rol) |
| `/projects/{id}/members/{member}` | PATCH rol, DELETE membresía |
| `/projects/{id}/items` | GET con filtros y paginación, POST |
| `/projects/{id}/items/{item}` | PATCH, DELETE lógico |
| `/projects/{id}/backlog/reorder` | POST orden persistente |
| `/projects/{id}/sprints` | GET, POST |
| `/projects/{id}/sprints/{sprint}` | PATCH planificación/extensión |
| `/projects/{id}/sprints/{sprint}/start` | POST |
| `/projects/{id}/sprints/{sprint}/complete` | POST selección y destino |
| `/projects/{id}/items/{item}/history` | GET |
| `/projects/{id}/items/{item}/comments` | GET, POST |
| `/projects/{id}/activity` | GET paginado, solo lectura |
| `/projects/{id}/imports/[google/]columns` | POST inspección |
| `/projects/{id}/imports/[google/]preview` | POST validación |
| `/projects/{id}/imports/[google/]commit` | POST transacción |
| `/users` | GET directorio del equipo global |

La auditoría REA registra proyectos, sprints, miembros y modificaciones de tarjetas. Se evita auditar otra vez la inserción de sus propios registros de historial. Las importaciones generan un resumen sin almacenar el archivo. La autoría y fechas provienen del backend.

## Instalación, commit y despliegue

No hay variables de entorno nuevas. Mantener la configuración real de REA. Dependencias nuevas de producción: openpyxl y defusedxml. aiosqlite solo se utiliza en tests locales.

En una rama de trabajo de tu repositorio, incorporar el contenido de este ZIP conservando tu `.git` y configuración local; revisar el diff antes del commit:

```bash
git switch -c feat/morpheo-agile
# Incorporar los archivos del ZIP aquí; no reemplazar .git ni secretos locales.
git diff --stat
git diff
```

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_agile_schemas.py tests/test_agile_integration.py -q
# Con DATABASE_URL y SECRET_KEY reales de staging, respaldar primero su DB:
python -m alembic current
python -m alembic upgrade head
python -m alembic current
cd ../frontend
npm ci
npm run build
npm run lint
python check_i18n.py
npx playwright install chromium
npx playwright test tests/agile.spec.ts
```

Luego, desde la raíz: `git add backend frontend docs README.md`, revisar `git diff --cached` y `git commit -m "Integrate MORPHEO agile workspace on REA"`. Usar el proceso de despliegue existente (`Dockerfile` y `backend/prestart.sh` conservados), verificando migración, `/api/health`, login, correo de respaldo y acceso a `/admin/proyectos-agiles` en staging antes de producción. No se desplegó ni se ejecutaron migraciones sobre tu infraestructura.

Para revertir sin pérdida: volver al código REA y **dejar la migración 0007 aplicada**; sus tablas adicionales no afectan REA. Guardar un respaldo completo antes. Solo en una base desechable o si se acepta perder todos los datos ágiles: `python -m alembic downgrade 0006_backup_email`. No ejecutar ese downgrade en producción como paso automático de rollback.

## Pruebas y límites de la validación

- Build Vite/TypeScript: aprobado. Aviso no bloqueante por tamaño del bundle principal existente; el módulo ágil está separado.
- ESLint y verificación de claves i18n: aprobados.
- 16 tests backend + 4 subtests: aprobados. Incluyen persistencia SQLite con FK, autorización real por JWT, aislamiento, épicas, errores de entrada, orden, importación/XLSX/mapeo/duplicados/digest, historial, sprints y traslado selectivo. Los datos son efímeros y no se insertan en producción.
- 2 tests Playwright: aprobados (escritorio ES y móvil EN, tema oscuro). Usan respuestas API simuladas explícitas y comprueban navegación, creación, cambio de estado, modal por teclado, configuración y ausencia de desbordamiento horizontal global. No son pruebas E2E sobre PostgreSQL.
- Alembic: cadena inspeccionada, generación SQL PostgreSQL completa y desde REA y esquema OpenAPI cargados correctamente. No se ejecutó upgrade/downgrade en un servidor PostgreSQL.
- Comparación por bytes: preservación de los archivos anteriores fuera de la lista documentada; no se eliminaron archivos originales.
- No verificados externamente: SMTP real, Cloudflare, Google Sheets, migración real/concurrencia PostgreSQL ni deploy. Los tests originales de correo de respaldo requieren PostgreSQL desechable; se conservaron y deben ejecutarse allí (`tests/test_backup_email.py`, `tests/migration_test.py`, `tests/browser_test.py`).

Consultar `MORPHEO_FILES.md` para el inventario exacto y propósito de cada archivo nuevo/modificado. El módulo incluye una implementación funcional, con las diferencias y verificaciones pendientes expuestas arriba; no se presenta como una certificación de producción.
