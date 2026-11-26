# AJR Data 3.6 — Haniel

**Nombre clave:** `ajrdata-3.6-haniel`
**Base:** AJR Data 3.5 — Hercules (`ajrdata-3.5-hercules`)
**Entrega:** Rediseño integral del portfolio público y su administración; editor Bento configurable y estabilización visual posterior con referencia HTML.
**Estado:** implementación Haniel integrada en el código fuente local. Se validaron las pruebas de esquema/migración, sintaxis Python, sintaxis TSX y catálogos i18n. El build completo de frontend y el QA visual real en navegador siguen pendientes: el registro npm no resolvió DNS durante `npm ci` (`EAI_AGAIN`).

---

## 1. Resumen de Haniel 3.6

Haniel reemplaza la antigua presentación lineal del portfolio por una experiencia editorial oscura, modular y personalizable. La implementación mantiene el stack y los contratos anteriores cuando es posible, y agrega un modelo de bloques que permite que cada proyecto tenga su propia composición visual.

### 1.1 Portfolio público

- Identidad local del portfolio en negro, grafito y grises; no cambia el tema global del resto del sitio.
- Portada con navegación circular de proyectos: proyecto prioritario centrado y proyectos anterior/siguiente parcialmente visibles, desenfocados y con menor escala.
- Navegación por flechas, selección de tarjetas laterales y gesto horizontal de arrastre.
- El proyecto central conduce a `/portfolio/:projectId`. La ruta principal y las rutas de detalle usan el mismo componente y la misma consulta de TanStack Query, por lo que el listado ya cargado se reutiliza al abrir un proyecto.
- Tarjeta fija **«Más próximamente...»** en la portada, incluso cuando todavía no hay proyectos publicados.
- Detalle individual compuesto por una grilla Bento asimétrica de bloques; soporta texto, imágenes, video y archivos.
- Logo, título, resumen breve, estado, cliente opcional y enlace externo en la cabecera del proyecto.
- Navegación entre proyectos anterior/siguiente dentro del detalle.
- Transiciones de entrada con desenfoque, movimiento y opacidad; las preferencias `prefers-reduced-motion` desactivan las animaciones decorativas.
- Los medios se contienen en su bloque: imágenes con `object-fit: contain` o `cover`, ancho máximo del contenedor, overflow recortado y alturas limitadas. Los videos también tienen límites de ancho y alto.

### 1.2 Personalización visual

- Paleta por proyecto: fondo de tarjeta, borde, color de acento reactivo y color de texto principal.
- Paleta por bloque: fondo, borde y color de texto.
- Los bordes y brillos de hover toman el color de acento del proyecto; no dependen de los antiguos acentos azules/cian globales.
- Bloques de texto con negrita, cursiva y subrayado.
- Selección de fragmentos del texto para aplicar color sólido o degradado de dos colores.
- Los degradados se almacenan como dos valores HEX independientes.
- Los colores se validan en backend con formato `#RRGGBB`; no se admiten valores CSS arbitrarios.
- Los bloques de texto tienen límites de caracteres según su tamaño: pequeño 140, mediano 280, grande 520, ancho 640, alto 420 y completo 900.
- La API verifica de nuevo los límites, las URL y los rangos de formato; las validaciones no dependen solamente del navegador.

### 1.3 Administración del portfolio

- Listado ordenable de proyectos con prioridad numérica, logo/miniatura y estado.
- Arrastrar y soltar para cambiar el orden y controles accesibles de subir/bajar.
- Acción explícita **Guardar prioridad**; el backend persiste la lista completa y comprueba que no haya proyectos faltantes, extra o duplicados.
- Editor visual por secciones: datos básicos, bloques Bento y paleta del proyecto.
- Creación de bloques de texto, imagen, video y archivo, con tamaño seleccionable y orden configurable.
- Los bloques de imagen pueden mostrarse como cuadros sin texto ni caption; un proyecto puede componerse únicamente de imágenes.
- Previsualización de colores por bloque y paleta global.
- El resumen, el logo, el estado y los enlaces son campos opcionales salvo el título.
- Se conserva el permiso existente: ADMIN y TECHNICIAN pueden crear/editar y solamente ADMIN puede borrar.

---

### 1.4 Estabilización visual y navegación del portfolio

Esta revisión de Haniel incorpora la referencia HTML y el video del sitio actualmente publicado:

- `/portfolio` y `/portfolio/:projectId` montan `PortfolioAtmosphere` en lugar de `AuroraBackground`. También se oculta el indicador global de progreso superior en esas rutas; el fondo deja de reutilizar los brillos cian/violeta de la marca.
- El fondo propio utiliza una base de grafito/negro, retícula de baja intensidad, polvo de partículas plateadas y una **malla topográfica/isométrica de datos** en perspectiva. La malla se desplaza suavemente como un relieve técnico; no utiliza espirales, vórtices ni órbitas decorativas. Ninguno de estos elementos toma el acento del proyecto activo.
- El canvas limita la densidad según el viewport, utiliza un DPR máximo de 1.5, pausa `requestAnimationFrame` cuando la pestaña no está visible y queda estático con `prefers-reduced-motion`.
- Se conserva la navegación de AJR Data que aparece en el ZIP/video: `FloatingSidebar` colapsable en escritorio; `NavBar` compacta en móvil y el `SidebarDrawer` flotante con backdrop, cierre por Escape, control de foco y bloqueo del scroll. El `NavBar` existente ahora se monta realmente desde `AppLayout` en tablet/móvil. El footer y la burbuja de soporte mantienen los componentes compartidos de la aplicación.
- La tarjeta central conserva `z-index: 30`; las laterales no superan `z-index: 10`, tampoco con hover o focus. La etapa crea un contexto de apilamiento independiente y la reacción lateral se limita al contorno; el zoom de imagen se reserva a la tarjeta central.
- Los controles de anterior/siguiente conservan su hitbox; el brillo y la escala actúan sobre el contenido visual interior y no desplazan el botón.
- Se eliminó el cambio de mayúsculas y espaciado de los enlaces de navegación en hover, que alteraba su geometría. El drawer móvil usa una superficie oscura estable sin un sheen animado permanente.
- La entrada del portfolio utiliza una única transición específica de desenfoque/opacidad/desplazamiento, evitando competir con la animación global aplicada al resto de rutas.
- Los CTA principales, secundarios y el CTA de la tarjeta inferior de Home comparten geometría de píldora y área de interacción estable.

La atmósfera del portfolio queda intencionalmente **neutral**: los colores configurados para cada proyecto aparecen en el delineado, el brillo de hover, la numeración y los controles de navegación, no en el fondo general. Así el entorno da profundidad sin competir con capturas, logos o identidad de los proyectos.

---

## 2. Datos y API

### 2.1 Persistencia

La migración `0011_haniel_portfolio` agrega a `portfolio_items`:

| Campo | Tipo | Uso |
|---|---|---|
| `logo_url` | `VARCHAR(1000)` nullable | Logo individual del proyecto |
| `position` | `INTEGER NOT NULL` | Prioridad ascendente en la portada |
| `style` | `JSON NOT NULL` | Paleta del proyecto |
| `blocks` | `JSON NOT NULL` | Composición y contenido de cada cuadro Bento |

La migración inicializa el orden existente respetando el orden cronológico descendente que usaba el portfolio anterior. Los proyectos actuales conservan título, descripción, cliente, estado, enlaces y galería. `media` y `image_url` se mantienen para compatibilidad con los clientes anteriores; el editor nuevo utiliza `blocks` como composición principal.

El editor admite hasta 40 bloques Bento y hasta 30 elementos multimedia por proyecto, alineado con el límite heredado de la galería. Un bloque admite:

- `type`: `text`, `image`, `video` o `file`.
- `size`: `small`, `medium`, `large`, `wide`, `tall` o `full`.
- Contenido de texto o URL, caption opcional, ajuste de imagen `contain`/`cover`.
- Colores HEX de fondo, borde y texto.
- Degradado opcional con dos colores.
- Marcas de formato por rango (`start` / `end`): negrita, cursiva, subrayado, color sólido o degradado.

### 2.2 Endpoints

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| `GET` | `/api/portfolio` | Público | Listado ordenado por `position`, con bloques, estilo y galería |
| `GET` | `/api/portfolio/{item_id}` | Público | Detalle del proyecto |
| `POST` | `/api/portfolio` | ADMIN / TECHNICIAN | Crear proyecto |
| `PUT` | `/api/portfolio/{item_id}` | ADMIN / TECHNICIAN | Reemplazar datos, bloques, estilo y galería |
| `POST` | `/api/portfolio/reorder` | ADMIN / TECHNICIAN | Guardar prioridad de todos los proyectos |
| `DELETE` | `/api/portfolio/{item_id}` | ADMIN | Eliminar proyecto |

El request de reordenamiento tiene esta forma:

```json
{
  "ids": [12, 8, 21]
}
```

La lista debe contener exactamente los IDs existentes, una sola vez cada uno. Si la colección cambió entre la carga y el guardado, el backend responde `409 Conflict` para evitar guardar una prioridad parcial u obsoleta.

### 2.3 Comportamiento de compatibilidad

- Los proyectos anteriores sin `blocks` se presentan mediante una composición de respaldo generada con su descripción y sus elementos de `media`.
- `image_url` sigue siendo un campo calculado desde la primera imagen de `media`.
- El endpoint público continúa siendo `/portfolio`; no se crea una ruta backend nueva por cada proyecto.
- `/portfolio/:projectId` es una subruta frontend dinámica. Añadir un proyecto no requiere modificar `App.tsx` ni publicar nuevas rutas por proyecto.

---

## 3. Aplicar la versión

Antes de desplegar, generar una copia de seguridad de PostgreSQL y comprobar las variables de entorno de Hercules.

```bash
cd backend
alembic upgrade head
```

La revisión nueva es `0011_haniel_portfolio`, posterior a `0010_email_outbox`.

Para instalar y validar el frontend:

```bash
cd frontend
npm ci
npm run build
npm run lint
```

No ejecutar migraciones destructivas ni pruebas de smoke contra producción. La prueba de roundtrip de migraciones existente exige una base cuyo nombre contenga `test`.

---

## 4. Stack y arquitectura conservados

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, i18next y Lucide.
- **Backend:** Python, FastAPI, SQLAlchemy 2 async y Alembic.
- **Base de datos:** PostgreSQL.
- **Perímetro:** Cloudflare DNS y Cloudflare Turnstile ya presentes en formularios existentes.
- **Autenticación:** roles `ADMIN`, `TECHNICIAN` y `USER`; no se sustituye el mecanismo existente.

Haniel no agrega dependencias de interfaz para drag-and-drop ni un editor rich-text de terceros: utiliza eventos de arrastre del navegador, controles React y rangos de formato almacenados como datos estructurados.

---

## 5. Base heredada de Hercules 3.5

Haniel parte de AJR Data 3.5 — Hercules. Se mantienen los componentes y flujos incorporados en esa versión:

- Documentos legales de Privacidad, Términos y EULA ubicados en `docs/legal/`, considerados borradores hasta completar datos reales y revisión legal.
- Endpoint público `POST /api/orders/regret`, solicitud sin login, verificación acotada, rate limit, código de seguimiento y evento de auditoría.
- Outbox persistente de correo, reintentos progresivos y despacho periódico mediante APScheduler.
- Layout global con sidebar/drawer, rutas legales y página de arrepentimiento.
- Páginas de cuenta, pedidos, soporte y modalidades de contratación.
- Autenticación, permisos y módulos administrativos previos.

Los detalles normativos, las fuentes oficiales y las limitaciones del flujo de arrepentimiento se conservan en el historial de Hercules y en los documentos legales correspondientes; Haniel no constituye una revisión jurídica de esos contenidos.

---

## 6. Validación de Haniel

Pruebas de contrato y migración añadidas en `backend/tests/test_portfolio_haniel_schema.py` y `backend/tests/test_portfolio_haniel_migration.py`:

- Admite proyectos compuestos solo por imágenes y sin resumen textual.
- Aplica los límites de caracteres según tamaño de bloque.
- Exige los dos colores de un degradado.
- Rechaza colores CSS arbitrarios.
- Impide rangos de formato fuera del contenido.
- Conserva compatibilidad con el campo heredado `image_url`.
- Rechaza IDs duplicados en el ordenamiento.
- Comprueba que la migración añade las columnas nuevas, inicializa la prioridad de proyectos existentes y puede revertirse en SQLite.

**Estado de ejecución de esta revisión:** las 9 pruebas de esquema y migración pasan (`9 passed`); también pasan `py_compile` en los módulos Python de Haniel, la comprobación sintáctica de los cinco archivos TSX revisados, `frontend/check_i18n.py` y el parseo de todos los JSON de traducción. El primer intento de `npm ci` no pudo descargar los paquetes debido a un fallo DNS del registro npm (`EAI_AGAIN`); por eso no se informa un build TypeScript/Vite satisfactorio ni se considera que el type-check completo esté validado. Tampoco se realizó QA visual real en navegador. El build, el lint y la revisión en desktop/móvil/zoom/DPI siguen pendientes.

---

## 7. Limitaciones y siguientes controles

1. La subida directa de imágenes no está incluida: el editor continúa recibiendo URLs, como en Hercules. La integración de un proveedor de almacenamiento debe diseñarse y validarse por separado.
2. Los rangos de formato se reinician al editar el texto de un bloque. Esta decisión evita que los índices queden asociados a fragmentos incorrectos; se vuelve a seleccionar y aplicar el formato después de editar.
3. El drag-and-drop funciona con ratón/trackpad; los controles de prioridad ascendente/descendente constituyen la alternativa de teclado y toque.
4. Debe revisarse el comportamiento del carrusel con distintos números de proyectos, especialmente uno o dos, y con contenido de imagen de proporciones extremas.
5. Verificar permisos ADMIN/TECHNICIAN en un entorno integrado, incluyendo el rechazo de reordenamientos parciales y la respuesta `409` ante listas desactualizadas.
6. Verificar compatibilidad visual con `prefers-reduced-motion`, teclado, lectores de pantalla y viewports pequeños.
7. Comprobar que las URLs proporcionadas por administración apunten a recursos confiables y utilizar HTTPS en producción.

---

## 8. Criterios de calidad

La implementación toma como guía factores de McCall: corrección, confiabilidad, eficiencia, integridad y usabilidad; mantenibilidad, flexibilidad y testeabilidad; portabilidad, reusabilidad e interoperabilidad. La referencia metodológica no equivale a una certificación formal.

**Identificador de entrega:** `ajrdata-3.6-haniel` · **Portfolio Bento configurable**
