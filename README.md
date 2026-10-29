# AJR DATA — `ajrdata-v3.2-rea`

**AJR DATA** es una plataforma web para una consultora tecnológica orientada a PyMEs. Combina una web pública y portfolio con un espacio de clientes, gestión de pedidos, soporte y un panel interno para el equipo.

La entrega **`ajrdata-v3.2-rea`** amplía la base visual heredada de Laniakea 3.1 con una funcionalidad de seguridad full-stack: alta, verificación, consulta, cambio y eliminación de un correo electrónico de respaldo. Incorpora persistencia mediante Alembic, endpoints autenticados, controles de reautenticación, límites de solicitudes, traducciones ES/EN y una pantalla de seguridad de cuenta. El correo de respaldo es independiente del correo principal y **no se habilita para recuperar contraseñas en esta versión**.

Repositorio: [RonaldPoma27/AJR-V2.0.0](https://github.com/RonaldPoma27/AJR-V2.0.0)  
Rama base inspeccionada: [ajrdata-3.1-laniakea](https://github.com/RonaldPoma27/AJR-V2.0.0/tree/ajrdata-3.1-laniakea)  
Versión de esta entrega: **`ajrdata-v3.2-rea`**

---

## Contenido

- [Cambios incorporados en `ajrdata-v3.2-rea`](#cambios-incorporados-en-ajrdata-v32-rea)
- [Cambios de Laniakea 3.1 respecto de Hydra 3.0](#cambios-incorporados-en-laniakea-31-respecto-de-hydra-30)
- [Base visual heredada de Laniakea 3.1](#base-visual-heredada-de-laniakea-31)
- [Archivos visuales destacados](#archivos-visuales-destacados)
- [Verificaciones históricas de Laniakea 3.1](#verificaciones-históricas-de-laniakea-31)
- [Funcionalidades de la plataforma](#funcionalidades-de-la-plataforma)
- [Tecnologías](#tecnologías)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Historial de versiones y ramas](#historial-de-versiones-y-ramas)
- [Ejecutar el proyecto localmente](#ejecutar-el-proyecto-localmente)
- [Variables de entorno](#variables-de-entorno)
- [Deploy en Render](#deploy-en-render)
- [Verificaciones antes de publicar](#verificaciones-antes-de-publicar)

## Cambios incorporados en `ajrdata-v3.2-rea`

### Correo electrónico de respaldo

La cuenta dispone de una nueva pantalla en **`/cuenta/seguridad`** para administrar un correo alternativo. Esta dirección se mantiene separada del correo principal y no reemplaza la identidad principal de inicio de sesión.

- **Consulta de estado:** muestra si no está configurado, si está pendiente de verificación o si ya fue verificado.
- **Alta y cambio:** pide la contraseña actual, envía un código de seis dígitos por SMTP y mantiene el correo verificado anterior activo hasta verificar el nuevo.
- **Verificación:** códigos generados con `secrets`, almacenados solo como HMAC-SHA256 ligado al usuario, al desafío y a la dirección, con vencimiento configurable y uso único.
- **Protección contra abuso:** límites persistentes en PostgreSQL por usuario, dirección de destino e IP; espera mínima entre solicitudes y hasta cinco intentos por código por defecto. Los límites son configurables mediante variables de entorno.
- **Reenvío y eliminación:** requieren reautenticación con la contraseña actual; los desafíos abiertos se invalidan al reenviar o eliminar.
- **Avisos de seguridad:** si SMTP real está configurado, se avisa al correo principal después de verificar, cambiar o eliminar el método. Los fallos del aviso no revierten una operación ya confirmada.
- **Auditoría prudente:** se registran los eventos sin el código, el HMAC ni la dirección de respaldo. Las tablas sensibles se excluyen del registro ORM genérico.
- **Integridad:** una migración incremental `0006_backup_email` agrega las tablas y restricciones necesarias sin modificar revisiones anteriores. Las direcciones verificadas son únicas globalmente; las pendientes no reservan una dirección de forma permanente ni bloquean el registro de otra cuenta antes de demostrar control del correo.
- **Internacionalización y accesibilidad:** la interfaz incluye español e inglés, estados de carga/error/éxito, confirmación antes de eliminar y controles adaptables a móvil.

### Endpoints agregados

Todos los endpoints operan exclusivamente sobre el usuario autenticado; el frontend no envía un `user_id` para seleccionar la cuenta.

| Método | Endpoint | Función |
|---|---|---|
| `GET` | `/api/security/backup-email` | Consultar estado del correo de respaldo |
| `POST` | `/api/security/backup-email/request` | Solicitar alta o cambio; requiere correo y contraseña actual |
| `POST` | `/api/security/backup-email/verify` | Verificar el código de seis dígitos |
| `POST` | `/api/security/backup-email/resend` | Reenviar código; requiere contraseña actual |
| `DELETE` | `/api/security/backup-email` | Eliminar correo de respaldo; requiere contraseña actual en el cuerpo JSON |

La API responde con errores de validación, conflicto, autenticación, límites o indisponibilidad SMTP de acuerdo con las convenciones del backend. No se considera enviado un código cuando el servicio de correo falla.

### Migración y actualización

Esta versión agrega la revisión Alembic `0006_backup_email`, cuya revisión previa es `0005_order_plan_fields`. En el entorno configurado del backend se aplica con:

```bash
alembic upgrade head
```

Antes de desplegar en producción, confirmá la revisión actual de la base y hacé un respaldo. No edites migraciones históricas ya aplicadas.

### Variables de entorno para el correo de respaldo

| Variable | Predeterminado | Función |
|---|---:|---|
| `BACKUP_EMAIL_CODE_SECRET` | Derivado de `SECRET_KEY` si queda vacío | Secreto dedicado opcional de al menos 32 caracteres; usar uno aleatorio distinto en producción es recomendable |
| `BACKUP_EMAIL_CODE_TTL_MINUTES` | `10` | Vigencia del código; aceptado de 1 a 60 minutos |
| `BACKUP_EMAIL_MAX_ATTEMPTS` | `5` | Intentos de verificación permitidos por desafío |
| `BACKUP_EMAIL_RESEND_COOLDOWN_SECONDS` | `60` | Tiempo mínimo entre solicitudes/reenvíos |
| `BACKUP_EMAIL_MAX_REQUESTS_USER_PER_HOUR` | `5` | Límite horario por usuario |
| `BACKUP_EMAIL_MAX_REQUESTS_EMAIL_PER_HOUR` | `5` | Límite horario por dirección destino |
| `BACKUP_EMAIL_MAX_REQUESTS_IP_PER_HOUR` | `20` | Límite horario por IP |
| `BACKUP_EMAIL_CHALLENGE_RETENTION_HOURS` | `24` | Retención máxima configurada de desafíos; la limpieza se ejecuta con la tarea periódica existente |

**SMTP real es obligatorio para entregar códigos.** `EMAIL_BACKEND=console` registra los cuerpos completos de los emails de desarrollo y por eso el flujo de seguridad lo rechaza expresamente. Sin `EMAIL_BACKEND=smtp`, `SMTP_HOST` y un remitente SMTP (`SMTP_FROM` o `SMTP_USER`) configurados, la solicitud falla de forma explícita y no activa el correo pendiente. Las notificaciones informativas se omiten si no existe SMTP real.

### Límite funcional importante

El correo verificado queda almacenado como método alternativo de contacto, pero **no sirve para restablecer contraseñas, desactivar MFA ni omitir la autenticación**. La recuperación de cuenta por correo de respaldo no se implementó ni debe anunciarse como disponible en `ajrdata-v3.2-rea`.

### Verificaciones de esta entrega

Comprobaciones ejecutadas en el entorno de preparación del ZIP:

- **Compilación sintáctica backend:** `python -m compileall -q app alembic/versions tests` — aprobada.
- **Pruebas unitarias:** `python -m unittest tests.test_backup_email_security` — 9 pruebas aprobadas. Cubren códigos de seis dígitos, HMAC contextual, validación de schemas, unicidad parcial y comportamiento de envío/logs con transporte SMTP simulado.
- **Internacionalización:** `python3 frontend/check_i18n.py` — aprobado; ES/EN mantiene claves correspondientes.
- **Archivos de traducción:** parseo JSON de los archivos raíz y de cuenta — aprobado.
- **Historial de migraciones:** `alembic heads` — `0006_backup_email` aparece como cabeza única.
- **Generación offline de SQL:** `alembic upgrade head --sql` — se generó el SQL de toda la cadena y se verificaron las tablas/índices nuevos. **Esto no ejecuta la migración en una base real.**
- **Parseo TS/TSX:** 71 archivos sin errores sintácticos mediante TypeScript `transpileModule`. Esta comprobación no resuelve imports ni reemplaza el typecheck de `tsc`.

**Validaciones pendientes por limitaciones del entorno:** no se pudo completar `npm ci` porque el paquete requerido no estaba en la caché y el registro npm no era accesible. Por eso `npm run build`, `npm run lint` y el typecheck completo no se consideran aprobados. Tampoco se ejecutaron los endpoints contra una base PostgreSQL real, no se aplicó la migración a datos existentes y no se envió correo a través de un servidor SMTP real. Las pruebas de email usan un transporte SMTP simulado. Antes de desplegar, completá esas validaciones en el entorno del proyecto y revisá los logs de la migración.

---

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

## Base visual heredada de Laniakea 3.1

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

## Verificaciones históricas de Laniakea 3.1

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
- **Seguridad de cuenta** (`/cuenta/seguridad`): administración del correo de respaldo, independiente del correo principal; no habilita recuperación de contraseña.
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
| **3.2 — `ajrdata-v3.2-rea`** | Entrega local basada en `ajrdata-3.1-laniakea` | Gestión segura del correo de respaldo: modelos, servicios, endpoints, migración `0006_backup_email`, pantalla `/cuenta/seguridad`, ES/EN y pruebas dirigidas. La recuperación de contraseña por correo de respaldo no está implementada. |
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
| `BACKUP_EMAIL_CODE_SECRET` | Secreto opcional dedicado al HMAC de códigos; si se omite, se deriva de `SECRET_KEY`. |
| `BACKUP_EMAIL_CODE_TTL_MINUTES`, `BACKUP_EMAIL_MAX_ATTEMPTS`, `BACKUP_EMAIL_RESEND_COOLDOWN_SECONDS` | Vencimiento, intentos y frecuencia de códigos de correo de respaldo. |
| `BACKUP_EMAIL_MAX_REQUESTS_USER_PER_HOUR`, `BACKUP_EMAIL_MAX_REQUESTS_EMAIL_PER_HOUR`, `BACKUP_EMAIL_MAX_REQUESTS_IP_PER_HOUR` | Límites de solicitudes persistidos en PostgreSQL. |
| `BACKUP_EMAIL_CHALLENGE_RETENTION_HOURS` | Ventana de retención de desafíos y registros para rate limit. |
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
