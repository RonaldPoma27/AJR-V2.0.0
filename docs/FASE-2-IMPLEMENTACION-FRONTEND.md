# AJR Data 3.5 Hercules — Informe de Fase 2

**Estado:** integración implementada sobre `ajrdata-3.5-hercules` (Fase 1).
**Fecha:** 12 de noviembre de 2026.

## Entregables completados

1. **Layout global:** `AppLayout.tsx` coloca una sidebar flotante, persistente y contraíble en escritorio. En móvil/tablet utiliza un drawer con cierre por Escape, foco contenido, bloqueo de scroll de fondo y recuperación de foco.
2. **Acceso público y sesión:** navegación desktop y móvil, cambio de idioma, login/registro para invitados y logout para sesiones activas.
3. **Acceso al arrepentimiento:** enlace destacado en sidebar, barra superior móvil y footer. En móvil el rótulo permanece visible, incluso en viewports angostos.
4. **Formulario público:** `/arrepentimiento` utiliza `POST /api/orders/regret`, no requiere sesión y muestra el código de seguimiento que devuelve HTTP 202. Permite precompletar `pedido` y `email` mediante query string.
5. **Mis pedidos:** cada pedido desplegado permite enviar la solicitud con el ID y email que ya constan en el pedido, y muestra el código de recepción devuelto por la API.
6. **Documentación legal:** `/privacy`, `/terms` y `/eula` reutilizan `LegalDocumentPage.tsx`, que renderiza los Markdown de `docs/legal/` sin interpretar HTML arbitrario. Los documentos con campos de titular pendientes muestran advertencia de borrador.
7. **Contratación laboral:** `TrabajaConNosotros.tsx` integra acordeones accesibles con explicación de tiempo indeterminado, plazo fijo, eventual, tiempo parcial, temporada, servicios independientes y teletrabajo; incluye fuentes oficiales enlazadas.
8. **Estilo visual:** se añadieron estilos responsive de sidebar, drawer, botones legales, formulario, documentación y acordeones. Se respeta `prefers-reduced-motion`; no se agregan dependencias.

## Decisiones de dominio

- El CTA no se desactiva según `created_at`: ese campo es la fecha de creación del pedido en el portal, no prueba la celebración del contrato ni la entrega. El backend recibe la solicitud y el equipo revisa los antecedentes y excepciones aplicables.
- No hay relación de datos entre `ClientOrder` y `AgileWorkItem`; no se modifican ni suspenden tareas Scrumban automáticamente.
- La API registra la solicitud, auditoría y outbox de email en una sola transacción. La página devuelve el código de inmediato; el correo se procesa de forma asíncrona. La entrega en 24 horas requiere SMTP, scheduler y alertas operativas.
- La Disposición 954/2025 contempla además un botón de baja de servicio, distinto del arrepentimiento, para los supuestos comprendidos en el artículo 10 ter de la Ley 24.240. No forma parte del flujo implementado en esta entrega y debe evaluarse antes de ofrecer servicios continuos a distancia.

## Validación y limitaciones

- Los archivos JSON de traducción (20 archivos en los directorios de idioma) se parsearon correctamente.
- 82 archivos TypeScript/TSX pasaron el transpilado sintáctico de TypeScript. Esto no sustituye el type-check.
- Las 7 pruebas focalizadas del backend (`test_order_regret_schema.py` y `test_email_outbox.py`) pasaron en la validación final.
- Las páginas y hooks se revisaron contra el contrato actual del backend (`order_id`, `contact_email`, `request_code`, `requested_at`).
- `npm ci` no terminó en este entorno; se agotó el tiempo disponible y dejó `node_modules` incompleto. Por ese motivo no se pudo completar `npm run build`, `tsc -b`, `npm run lint` ni pruebas de navegador.
- Falta QA manual con Windows/Chrome/Edge, resoluciones, zoom, lectores de pantalla y dispositivos móviles.
- Los documentos `PRIVACY.md`, `TERMS.md` y `EULA.md` continúan siendo borradores; completar todos los datos entre corchetes y revisar la operación real, proveedores, retención y contratos con asesoramiento jurídico.

## Fuentes normativas oficiales consultadas

- [Ley 20.744 — texto actualizado](https://www.argentina.gob.ar/normativa/nacional/25552/actualizacion)
- [Ley 24.240 — texto actualizado](https://www.argentina.gob.ar/normativa/nacional/638/actualizacion)
- [Disposición 954/2025 — texto](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-954-2025-417152/texto)
- [Ley 27.555 — Teletrabajo](https://www.argentina.gob.ar/normativa/nacional/ley-27555-341093/texto)
