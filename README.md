# AJR DATA — Laniakea 3.1

**AJR DATA** es una plataforma web para una consultora tecnológica orientada a PyMEs. Combina una web pública y portfolio con un espacio de clientes, gestión de pedidos, soporte y un panel interno para el equipo.

La versión **Laniakea 3.1** profundiza la identidad **Dark Premium Tech** de AJR Data sobre la base **Hydra 3.0**. Esta documentación conserva la descripción general de la plataforma y agrega un changelog específico de los cambios visuales de la versión 3.1. Esta entrega se concentra en el frontend: mejora la composición del inicio, la tipografía, el portfolio y la experiencia visual del chat sin redefinir las rutas ni sustituir la API o el esquema de la base de datos.

Repositorio: [RonaldPoma27/AJR-V2.0.0](https://github.com/RonaldPoma27/AJR-V2.0.0)  
Rama anterior: [ajrdata-3.0-hydra](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-3.0-hydra)  
Rama de esta versión: [ajrdata-3.1-laniakea](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-3.1-laniakea)  
Versión de esta entrega: **AJR Data Laniakea 3.1 — frontend visual**

---

## Contenido

- [Cambios de Laniakea 3.1 respecto de Hydra 3.0](#cambios-incorporados-en-laniakea-31-respecto-de-hydra-30)
- [Qué incluye Laniakea 3.1](#qué-incluye-laniakea-31)
- [Archivos visuales destacados](#archivos-visuales-destacados)
- [Verificaciones de Laniakea 3.1](#verificaciones-de-laniakea-31)
- [Funcionalidades de la plataforma](#funcionalidades-de-la-plataforma)
- [Tecnologías](#tecnologías)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Historial de versiones y ramas](#historial-de-versiones-y-ramas)
- [Ejecutar el proyecto localmente](#ejecutar-el-proyecto-localmente)
- [Variables de entorno](#variables-de-entorno)
- [Deploy en Render](#deploy-en-render)
- [Verificaciones antes de publicar](#verificaciones-antes-de-publicar)

## Cambios incorporados en Laniakea 3.1 respecto de Hydra 3.0

Esta sección complementa la documentación de **Hydra 3.0**. Describe las incorporaciones visuales de Laniakea 3.1 y no reemplaza las funcionalidades de la plataforma descritas más abajo.

- **Tipografía con más personalidad:** Space Grotesk se utiliza para títulos y encabezados; Inter queda para párrafos, formularios, mensajes y contenido de lectura. Se definen alternativas de fuente para mantener la legibilidad si Google Fonts no está disponible.
- **Hero de composición dividida:** el mensaje y las llamadas a la acción se ubican en una columna, mientras una composición abstracta tecnológica ocupa la otra. No se agregan métricas de negocio ficticias.
- **Fondo de aurora y grilla:** se suma una grilla técnica sutil al fondo ambiental, acotada al área de contenido para no competir con la lectura.
- **Proceso en cuatro etapas:** se presenta visualmente una secuencia resumida para explicar el recorrido de un proyecto. Es contenido informativo y no altera el estado real de pedidos o proyectos.
- **Portfolio Bento/editorial:** el primer proyecto devuelto por la API recibe mayor jerarquía visual sin modificar el orden recibido. En el detalle se priorizan el título, la descripción y la información disponible antes de los medios. Las imágenes conservan su proporción y se centran en el contenedor.
- **Chat con transición de transformación:** la apertura se diseña para que la burbuja parezca expandirse hasta convertirse en la ventana. La secuencia combina giro breve, escala, brillo y entrada escalonada del contenido, con una duración objetivo aproximada de 380–450 ms.
- **Estilo compartido para soporte:** se armonizan la burbuja, el historial, el formulario de chat nuevo, los mensajes y el indicador de escritura, además de las áreas de conversación de `/cuenta/soporte` y `/admin/soporte`. La lógica de conversación sigue usando los mecanismos existentes.
- **Ventanas de chat opacas:** cabecera con gradiente cian-violeta, mensajes enviados con acento cian y mensajes recibidos sobre superficies oscuras. No se aplica glassmorphism a la ventana de chat.
- **Glassmorphism selectivo:** se reserva para superficies destacadas. La navbar, la navbar móvil, el drawer/panel lateral y las ventanas de chat mantienen fondos opacos. La barra móvil utiliza un tono sólido alineado con el fondo del logo.
- **Componentes públicos coherentes:** se refinan el aspecto de las tarjetas de servicios, la jerarquía de textos y las superficies destacadas manteniendo la paleta oscura existente: cian como acento principal y azul/violeta como secundarios.
- **Movimiento reducido:** las animaciones deben respetar `prefers-reduced-motion`; los efectos visuales no deben impedir abrir/cerrar el chat, leer mensajes o navegar por teclado.

### Qué no cambia en Laniakea 3.1

- No se redefinen las rutas de la aplicación ni se agregan endpoints.
- No se modifican modelos, migraciones ni el esquema de la base de datos.
- No se reemplazan los datos reales del portfolio por contenido de demostración.
- No se cambian los flujos de autenticación, permisos o envío de mensajes intencionalmente; se recomienda validarlos de nuevo después del build.
- No se aplica glassmorphism a la navbar ni al panel lateral.

## Qué incluye Laniakea 3.1

Laniakea 3.1 conserva la identidad visual oscura de Hydra 3.0 y suma una composición más expresiva, tipografía con mayor personalidad y una experiencia más cuidada para portfolio y soporte. El alcance de esta entrega es visual y frontend-only.

- **Dirección visual:** fondos oscuros existentes, cian como acento principal y azul/violeta como secundarios; no se reemplaza la paleta oscura base.
- **Tipografía:** Space Grotesk para títulos y encabezados; Inter para el texto de cuerpo, con `display=swap` y alternativas de fuente.
- **Hero dividido:** mensaje y CTA en la columna izquierda y composición tecnológica abstracta CSS en la derecha; no agrega métricas de negocio ficticias.
- **Fondo ambiental:** aurora y grilla técnica sutil limitadas al espacio de contenido.
- **Proceso visual:** sección de cuatro etapas con estructura responsive.
- **FAQ:** conserva las preguntas y el comportamiento de acordeón existente, con mejoras visuales y accesibles.
- **Portfolio híbrido:** Bento al inicio del listado, destaca visualmente el primer proyecto devuelto por la API sin reordenar la colección y mantiene título y descripción antes de los medios.
- **Chat con transición de transformación:** la burbuja cambia visualmente hacia una ventana mediante rotación breve, expansión, halo y entrada escalonada; el tiempo objetivo de la animación es de unos 430 ms.
- **Conversaciones:** estilo visual compartido para burbuja, historial, creación de chat y mensajes, además de las vistas de soporte de cliente y de conversación en administración.
- **Superficies sin cristal:** navbar, drawer/panel lateral y ventanas de chat son opacos; el efecto cristal se limita a superficies públicas seleccionadas.
- **Responsive y movimiento reducido:** ajustes para pantallas pequeñas y reglas CSS que reducen o eliminan animaciones cuando se solicita `prefers-reduced-motion`.
- **Alcance conservador:** no se agregan rutas, endpoints ni cambios de esquema. Los datos del portfolio y de chat siguen procediendo de las APIs existentes.

### Alcance heredado de Hydra 3.0

Laniakea 3.1 mantiene las bases de Hydra 3.0: modo oscuro permanente, navegación existente, paleta oscura, componentes de formulario y los flujos ya implementados. La clase `dark` se establece desde la carga inicial para evitar un flash blanco; se retira el control de tema claro/oscuro y su lógica asociada. Se mantiene el drawer de navegación con su comportamiento existente y no se incorpora un efecto cristal en la navbar o panel lateral.

- **Modo oscuro permanente.** La clase `dark` se establece desde la carga inicial para evitar un flash blanco. Se retira el control de tema claro/oscuro y su lógica asociada.
- **Paleta Dark Premium Tech.** Fondos azul-negro, superficies oscuras, bordes sutiles y acentos degradados cian, azul y violeta. El texto principal, secundario, los campos y los mensajes se adaptan a una lectura de alto contraste.
- **Navegación mediante drawer.** La navegación de cuenta y administración se concentra en un menú hamburguesa en la parte superior izquierda, en lugar de una barra lateral fija. El panel contempla cierre con `Escape`, clic fuera, foco visible y atributos accesibles.
- **Inicio renovado.** Se reorganizan el hero, el llamado a la acción y las tarjetas de servicios. Se incorpora una sección de preguntas frecuentes en acordeón, con una sola respuesta abierta a la vez y traducciones en español e inglés.
- **Portfolio.** Se priorizan las descripciones y los enlaces antes de la galería. Las imágenes mantienen su proporción y se presentan centradas.
- **Consistencia entre pantallas.** Se armonizan estilos de formularios, cuenta, soporte, administración, gráficos, botones, notificaciones y pie de página.
- **Responsive y accesibilidad.** Se contemplan pantallas pequeñas, foco visible y la preferencia `prefers-reduced-motion` para reducir los movimientos decorativos.

### Alcance de Hydra

Hydra 3.0 es un **rediseño de frontend**. Mantiene las rutas declaradas por la aplicación y las llamadas existentes a la API. No introduce por sí misma nuevas migraciones, tablas ni endpoints de backend.

Los cambios visuales no sustituyen las verificaciones funcionales: antes de publicar se debe comprobar el build completo, la autenticación, el envío de formularios, los permisos por rol, las rutas internas y el comportamiento del drawer con sesión iniciada.

## Archivos visuales destacados

La implementación modifica componentes existentes. Esta lista describe los archivos principales afectados; no implica cambios en las rutas ni en los contratos de la API.

| Archivo | Alcance |
|---|---|
| `frontend/index.html` | Carga de Space Grotesk e Inter mediante Google Fonts, con alternativas y `display=swap`. |
| `frontend/src/index.css` | Sistema de diseño visual, tipografía, hero, Bento, proceso, tarjetas, estados del chat, animaciones y responsive. |
| `frontend/src/pages/Home.tsx` | Hero dividido, visual tecnológico abstracto, sección de proceso de cuatro pasos y estilos del contenido del inicio. |
| `frontend/src/pages/Portfolio.tsx` | Primer proyecto destacado según el orden recibido y detalles editoriales con medios centrados. |
| `frontend/src/components/layout/AppLayout.tsx` | Clase de contexto visual compartido para rutas públicas. |
| `frontend/src/components/layout/AuroraBackground.tsx` | Capas de aurora y movimiento ambiental moderado. |
| `frontend/src/components/layout/NavBar.tsx` y `Sidebar.tsx` | Refinamientos visuales conservando fondos opacos. |
| `frontend/src/components/ui/PricingCards.tsx` | Ajustes visuales de tarjetas existentes; el contenido y los destinos no se sustituyen. |
| `frontend/src/components/support/ChatBubble.tsx` | Montaje, apertura/cierre animados y foco al abrir/cerrar el chat. |
| `frontend/src/components/support/ChatHistory.tsx`, `NewChatForm.tsx`, `ChatThread.tsx`, `TypingIndicator.tsx` | Estilo compartido de historial, formulario, mensajes, estados e indicador de escritura. |
| `frontend/src/pages/account/Soporte.tsx`, `frontend/src/pages/admin/AdminSupport.tsx` | Composición visual de las zonas de conversación; el resto del panel administrativo permanece fuera del rediseño. |
| `frontend/src/i18n/parts/public.es.json` y `public.en.json` | Textos localizados del hero, proceso y portfolio. |
| `frontend/src/components/layout/ThemeToggle.tsx` | Eliminado por no tener referencias activas en el frontend de esta base y ser incompatible con el tema oscuro permanente. |
| `README.md` | Documentación de Laniakea 3.1 y continuidad de las guías generales heredadas de Hydra 3.0. |

## Verificaciones de Laniakea 3.1

Las comprobaciones ejecutadas sobre esta entrega:

- **JSON de traducciones:** los archivos se validaron sintácticamente; español e inglés conservan el mismo conjunto de claves.
- **Validador i18n del proyecto:** `python3 frontend/check_i18n.py` terminó correctamente.
- **Parseo estático TS/TSX:** los 68 archivos TypeScript/TSX se pudieron parsear sin errores sintácticos.
- **Balance de bloques CSS:** se comprobó la correspondencia de llaves en `frontend/src/index.css`.
- **Backend:** no se modificaron archivos del backend, migraciones ni contratos de API.

**Limitación:** no se pudo completar la instalación de dependencias de npm en el entorno de trabajo (no había acceso/cache disponible para resolver todos los paquetes y la instalación expiró). Por este motivo, el build de Vite/TypeScript y ESLint no se consideran aprobados ni verificados en esta entrega. Antes de desplegar, ejecutar `npm ci`, `npm run build` y `npm run lint` dentro de `frontend/`, y hacer una comprobación manual de las rutas públicas y de los chats con sesiones y permisos válidos.

La animación visual no reemplaza pruebas de funcionamiento. Verificá que abrir/cerrar el chat, seleccionar conversaciones, crear un chat, enviar mensajes, cerrar con Escape y devolver foco al lanzador siga funcionando en el navegador real.

## Funcionalidades de la plataforma

Las funcionalidades descritas aquí proceden de la documentación y el código de las líneas 2.x; su disponibilidad concreta depende de los archivos y la configuración presentes en la rama desplegada.

### Sitio público

- Página de inicio con presentación de servicios y llamadas a la acción.
- Portfolio con detalle y galerías de medios.
- Formulario para solicitar proyectos.
- Página para postulaciones: **Trabajá con nosotros**.
- Inicio de sesión y registro de clientes.
- Verificación anti-spam mediante Cloudflare Turnstile, de acuerdo con la configuración del entorno.

### Espacio del cliente

- **Mi cuenta** (`/cuenta`).
- **Mis pedidos** (`/cuenta/pedidos`).
- **Soporte** (`/cuenta/soporte`).
- Solicitud de proyectos con ruta protegida (`/solicitar-proyecto`).
- Seguimiento visual del estado del pedido y, en la línea 2.4.1A, del paso del proyecto cuando los campos correspondientes están disponibles.

### Panel interno

Los permisos se dividen entre `ADMIN` y `TECHNICIAN`. El alcance final de cada rol lo determina el backend.

- Pedidos: `/admin/pedidos`.
- Postulaciones: `/admin/postulaciones`.
- Soporte: `/admin/soporte`.
- Portfolio: `/admin/portfolio`.
- Equipo: `/admin/equipo`.
- Papelera: `/admin/papelera` — solo administración.
- Auditoría: `/admin/auditoria` — solo administración.

La línea 2.4.1 documenta gráficos para pedidos, ingresos estimados por tipo de servicio, estados, planes elegidos y dominio/hosting. Los ingresos de esos gráficos son **estimaciones calculadas**, no cobros confirmados.

### Seguridad y operaciones documentadas en 2.x

- Autenticación y rutas protegidas por sesión y rol.
- Registro de operaciones de administración y equipo en auditoría.
- Protección anti-spam y límites por IP.
- Papelera con restauración y purga programada, según configuración.
- Avisos por correo para nuevas solicitudes, postulaciones y cambios de estado cuando SMTP está configurado.
- API bajo `/api`, con documentación disponible en `/api/docs`.

## Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios, i18next, Lucide React |
| Backend | FastAPI, Python, SQLAlchemy 2 async, Pydantic y Alembic |
| Base de datos | PostgreSQL |
| Desarrollo integrado | Docker y Docker Compose |
| Deploy documentado | Render con Docker; el servidor FastAPI sirve el frontend compilado y la API |

## Estructura del repositorio

```text
/
├── frontend/                # Aplicación React + Vite
│   ├── public/               # Recursos estáticos, incluido el logo
│   └── src/
│       ├── api/              # Clientes y funciones para consumir la API
│       ├── components/       # Layout, formularios, UI, soporte y dashboard
│       ├── i18n/              # Traducciones y configuración de idiomas
│       ├── lib/               # Utilidades y helpers del frontend
│       └── pages/             # Inicio, portfolio, cuenta, admin, formularios
├── backend/                  # API FastAPI y modelos de dominio
│   ├── alembic/              # Historial de migraciones de base de datos
│   └── app/                  # Rutas, esquemas, modelos, servicios y seguridad
├── Dockerfile                # Build multi-stage frontend + backend
├── docker-compose.yml        # Entorno local integrado
├── .env.example              # Ejemplo de configuración
└── README.md
```

## Historial de versiones y ramas

Las ramas usan nombres inspirados en cuerpos celestes. El cuadro siguiente reúne esos nombres y los hitos que se pueden respaldar con la documentación disponible. **No todos los README históricos coinciden con el nombre de su rama**, por lo que no se atribuyen cambios específicos a una versión cuando no es posible verificarlos.

| Versión / nombre | Rama | Resumen documentado |
|---|---|---|
| **3.1 — Laniakea** | [`ajrdata-3.1-laniakea`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-3.1-laniakea) | Continuación visual frontend-only de Hydra 3.0: Space Grotesk + Inter, hero dividido, aurora/grilla, proceso de cuatro etapas, portfolio Bento/editorial y transición animada de burbuja a ventana de chat. La rama objetivo es `ajrdata-3.1-laniakea`; esta entrega no redefine rutas ni contratos de API. |
| **3.0 — Hydra** | [`ajrdata-3.0-hydra`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-3.0-hydra) | Rediseño frontend Dark Premium Tech: modo oscuro permanente, drawer unificado, textos de alto contraste, degradados de marca, FAQ acordeón y ajustes responsive. Es la versión base de la que parte Laniakea 3.1. |
| **2.4.1A — Phobos** | [`ajrdata-v2.4.1a-phobos`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v2.4.1a-phobos) | Hover con degradado en la navbar, parallax de la aurora, transición del tema con bloqueo de clics, tarjetas de planes, redirección protegida con persistencia del plan, formulario por pasos, stepper, gráficos y cambios de orden en el portfolio. La documentación histórica también menciona campos nuevos de pedidos en la base; verificar la migración real antes de desplegar. |
| **2.4.1B — Deimos** | [`ajrdata-v2.4.1b-deimos`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v2.4.1b-deimos) | Rama histórica visible en GitHub. El README disponible no permite reconstruir de forma fiable las diferencias específicas de esta variante. |
| **2.4 — Io** | [`ajrdata-v2.4-io`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v2.4-io) | Línea de mejoras UX/UI: tema claro/oscuro, fondo aurora, navegación responsive, animaciones de botones y soporte, transiciones al entrar en pantalla, notificaciones y respeto por movimiento reducido. |
| **2.3 — Calisto** | [`ajrdata-v2.3-calisto`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v2.3-calisto) | Rama histórica. El README de esa rama describe características de 2.4, así que sus diferencias exactas respecto de 2.2 no se pueden afirmar solo con esa documentación. |
| **2.2 — Ganimedes** | [`ajrdata-v2.2-ganimedes`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v2.2-ganimedes) | Rama histórica. El README disponible conserva contenido de 2.1 y no alcanza para atribuir cambios exclusivos a esta versión. |
| **2.1 — Europa** | [`ajrdata-v2.0-europa`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v2.0-europa) | Roles `USER`, `TECHNICIAN` y `ADMIN`; cuentas de clientes; pedidos asociados a usuarios; papelera y purga programada; correos de cambios de estado; portfolio multimedia y chat de soporte. El nombre de la rama conserva el prefijo `v2.0`, aunque corresponde a la versión 2.1 según la nomenclatura del proyecto. |
| **2.0 — Titan** | [`ajrdata-v2.0-titan`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v2.0-titan) | Menú “Nosotros”, contacto, postulaciones, validación de formularios, defensas anti-spam, correos automáticos, autenticación y primer panel de administración. |
| **1.2 — Phoebe** | [`ajrdata-v1.2-phoebe`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v1.2-phoebe) | Rama histórica de la línea 1.x. No se encontró un changelog independiente y consistente en la documentación consultada. |
| **1.1 — Prometeo** | [`ajrdata-v1.1-prometeo`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v1.1-prometeo) | Rama histórica de la línea 1.x. El README conservado describe la línea 2.0, por lo que no se usa como evidencia de cambios propios de 1.1. |
| **1.0 — Luna** | [`ajrdata-v1.0-luna`](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-v1.0-luna) | Rama inicial. Los detalles de su alcance original quedan pendientes de recuperar desde el historial de commits. |

### Nota sobre la reconstrucción del historial

Los nombres de rama y la secuencia de versiones se tomaron del registro histórico. Las características funcionales se reconstruyeron con el README disponible en `main`, los README accesibles de algunas ramas y el trabajo frontend de Hydra. Para 1.x, 2.2, 2.3 y 2.4.1B hace falta revisar los commits de cada rama para redactar un changelog completo sin inventar diferencias.

## Guía de como ejecutar el programa localmente:

### Opción A: levantar frontend, API y PostgreSQL con Docker Compose

Requisitos: Git y Docker Desktop (con Docker Compose).

1. Cloná el repositorio y entrá a su carpeta:

   ```bash
   git clone https://github.com/RonaldPoma27/AJR-V2.0.0.git
   cd AJR-V2.0.0
   ```

2. Copiá el archivo de ejemplo de variables de entorno:

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env
   ```

   **Linux / macOS**

   ```bash
   cp .env.example .env
   ```

3. Editá `.env`. Como mínimo, configurá `SECRET_KEY` y las variables de administrador si necesitás entrar al panel. Generá una clave aleatoria con:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

4. Construí e iniciá los servicios:

   ```bash
   docker compose up --build
   ```

5. Abrí:
   - Sitio: <http://localhost:8000>
   - Documentación de API: <http://localhost:8000/api/docs>
   - Health check: <http://localhost:8000/api/health>

### Opción B: ejecutar solo el frontend en desarrollo

Necesitás que la API esté en ejecución y que la configuración de Vite apunte al backend local.

```bash
cd frontend
npm install
npm run dev
```

Abrí la dirección local que indique Vite, normalmente <http://localhost:5173>.

Comandos disponibles en `frontend/package.json`:

```bash
npm run dev       # servidor de desarrollo
npm run build     # comprobación TypeScript y build de producción
npm run preview   # previsualizar el build
npm run lint      # ESLint
```

### Backend por separado

El backend requiere una instancia PostgreSQL y las variables descritas en `.env.example`.

```bash
cd backend
python -m venv .venv
```

En Windows PowerShell, activá el entorno con:

```powershell
.venv\Scripts\Activate.ps1
```

En Linux o macOS:

```bash
source .venv/bin/activate
```

Después, instalá dependencias y configurá la conexión a PostgreSQL antes de ejecutar las migraciones:

```bash
pip install -r requirements.txt
alembic upgrade head
python -m app.scripts.create_admin
uvicorn app.main:app --reload
```

No ejecutes migraciones contra una base de producción sin verificar previamente la revisión actual y disponer de un respaldo.

## Variables de entorno

Usá `.env.example` como referencia oficial para la rama que vas a ejecutar. La configuración puede variar entre versiones.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. En una base externa puede requerir `?sslmode=require`. |
| `SECRET_KEY` | Clave de firma de sesión; debe ser aleatoria y tener al menos 32 caracteres. |
| `ENVIRONMENT` | Entorno de ejecución, por ejemplo `production` o `development`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME` | Creación del administrador inicial. |
| `TURNSTILE_SECRET_KEY` | Clave secreta de Cloudflare Turnstile para validación en el servidor. |
| `VITE_TURNSTILE_SITE_KEY` | Clave pública de Turnstile; se incorpora al frontend en el build. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TLS` | Configuración de envío de correo. |
| `ADMIN_NOTIFY_EMAIL` | Destino de los avisos del sistema. |
| `PUBLIC_BASE_URL` | URL pública usada para enlaces dentro de correos. |
| `TRASH_RETENTION_DAYS`, `TRASH_PURGE_INTERVAL_MINUTES`, `SCHEDULER_ENABLED` | Configuración de retención y limpieza de la papelera. |
| `EMAIL_BACKEND` | Proveedor de correo; `console` permite probar mediante logs en desarrollo. |

**Nunca subas `.env`, contraseñas, `SECRET_KEY` ni la clave secreta de Turnstile al repositorio.** Los nombres y valores aceptados por el código de la rama activa siempre prevalecen sobre esta tabla resumida.

## Deploy en Render

La documentación del proyecto usa un servicio Docker que compila el frontend y deja que FastAPI sirva los archivos estáticos y la API.

1. Creá o abrí el Web Service vinculado al repositorio.
2. Runtime: **Docker**.
3. Dockerfile Path: `./Dockerfile`.
4. Docker Build Context: raíz del repositorio (`.`).
5. Health Check Path: `/api/health`.
6. Configurá las variables de entorno necesarias y revisá que el servicio despliegue la rama correcta.
7. Confirmá el build, las migraciones y el arranque en los logs antes de probar el sitio.
