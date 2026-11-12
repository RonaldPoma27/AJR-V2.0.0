# Flujo de arrepentimiento — AJR Data 3.5 Hercules

**Estado:** recepción y trazabilidad de backend integradas con la interfaz pública y “Mis pedidos” en Hercules 3.5. Pendientes QA de navegador, SLA operativo y revisión de elegibilidad con antecedentes reales.

## Marco normativo considerado

- **Ley 24.240, artículo 34:** contempla la revocación en los supuestos de contratación a distancia de los artículos 32 y 33, dentro de diez días corridos contados desde la entrega del bien o la celebración del contrato, lo que ocurra último.
- **Código Civil y Comercial, artículos 1105–1116:** regula contratación a distancia, deber de información, revocación, forma de notificación, efectos y excepciones. El artículo 1110 fija la regla general de diez días y contiene reglas de cómputo relacionadas con la entrega posterior del bien y los días inhábiles.
- **Disposición 954/2025:** exige un enlace visible y destacado denominado “BOTÓN DE ARREPENTIMIENTO” en el primer acceso; no permite exigir registro previo ni trámites adicionales para usarlo. Su artículo 5 requiere comunicar el código de identificación dentro de las 24 horas y adoptar medidas para efectivizar la revocación. Derogó expresamente la Resolución 424/2020.
- **Disposición 3/2026:** admite verificaciones razonables, por medios habituales y con finalidad exclusiva de identidad y seguridad; no habilita convertirlas en obstáculos burocráticos.

La aplicación concreta exige revisar el tipo de operación y la condición de consumidor. La Disposición 954/2025 contempla exclusiones, entre otras, para productos o servicios adquiridos con fines de reventa o integrados en procesos productivos, de transformación, comercialización o prestación a terceros cuando se relacionen con esos procesos. No debe clasificarse automáticamente toda operación empresarial como alcanzada o excluida.

## Flujo técnico integrado en Hercules 3.5

1. La página pública `/arrepentimiento` permite iniciar el trámite sin login ni alta de cuenta. El enlace está disponible desde la barra de navegación móvil, sidebar de escritorio y footer.
2. React envía `POST /api/orders/regret` con `order_id` y `contact_email`. La comparación del email es insensible a mayúsculas/minúsculas y sirve como verificación acotada de identidad/seguridad.
3. FastAPI aplica rate limit y busca un pedido activo. Ante pedido inexistente o email no coincidente devuelve un error genérico para no revelar información de terceros.
4. El backend genera una referencia `AJR-AR-XXXXXXXXXXXXXXX`, guarda `regret_requested_at` y `regret_code` y registra `regret_requested` en `audit_logs`.
5. En la **misma transacción** se guarda una fila en `email_outbox`. La respuesta HTTP 202 incluye inmediatamente el código y la fecha de recepción; un worker de APScheduler procesa el email en segundo plano.
6. El worker consulta hasta 20 mensajes pendientes por ciclo, usa `FOR UPDATE SKIP LOCKED` para evitar despacho concurrente entre instancias PostgreSQL, y reintenta fallos con espera exponencial de dos minutos hasta un máximo de una hora entre intentos.
7. Los reintentos se conservan en base de datos. Si existen mensajes pendientes por más de 24 horas, el worker emite un log de error que debe conectarse a alertas del entorno de producción.

### Contrato de API

**Request**

```json
{
  "order_id": 1042,
  "contact_email": "contacto@empresa.com"
}
```

**Response — HTTP 202 Accepted**

```json
{
  "request_code": "AJR-AR-A1B2C3D4E5F67890",
  "requested_at": "2026-11-12T20:00:00Z",
  "message": "Solicitud recibida. Conservá el código de seguimiento para consultar el trámite."
}
```

La recepción técnica no significa que AJR Data haya admitido jurídicamente la procedencia del derecho ni que se haya completado la revocación. El equipo debe revisar el contrato y ejecutar las medidas correspondientes sin usar esa revisión para crear barreras a la recepción.

### Persistencia

- `client_orders.regret_requested_at`: instante UTC de recepción.
- `client_orders.regret_code`: código único de trazabilidad.
- `audit_logs`: acción `regret_requested`, email asociado, IP, ruta, método y referencia del pedido.
- `email_outbox`: tipo de evento, clave de idempotencia, destinatario, payload mínimo, estado, intentos, próxima ejecución, fecha de envío y clase del último error.

## Límites y controles necesarios antes de producción

### Plazo legal y fecha del contrato

No se rechaza una solicitud comparando `created_at` con diez días. `client_orders.created_at` registra cuándo se creó el pedido dentro del sitio, no acredita la fecha en que se celebró el contrato ni, cuando corresponda, la entrega del bien. Rechazar en backend sobre ese dato podría bloquear una solicitud válida.

La plataforma todavía debe registrar el hito jurídico real del contrato y, cuando corresponda, la entrega. Hasta que esos datos existan y estén verificados, el backend recibe la solicitud y deja la elegibilidad para revisión humana. La Fase 2 no debe reintroducir un corte rígido basado únicamente en `created_at`.

### Correo y SLA de 24 horas

La outbox evita perder la intención de envío cuando el proceso se reinicia y proporciona reintentos. No constituye una garantía matemática de entrega: requiere `SCHEDULER_ENABLED=true`, SMTP configurado, monitoreo de logs/cola y una persona responsable de atender alertas. El proveedor SMTP puede rechazar o aceptar un mensaje sin garantizar que llegue a la bandeja de entrada. Para producción se recomienda ejecutar el worker como proceso dedicado y enviar alertas externas por métricas de pendientes y antigüedad de mensajes.

La API comunica el código inmediatamente en la respuesta web, mientras el correo se procesa desde la cola. Esto no reemplaza la obligación de adoptar las medidas para hacer efectiva la revocación; el estado del pedido y el trabajo contratado deben tener un procedimiento operativo de cancelación documentado.

### Baja de servicios (flujo independiente)

La Disposición 954/2025 regula además, en su artículo 4, un **“BOTÓN DE BAJA DE SERVICIO”** para solicitar la baja de servicios contratados a distancia, con base en el artículo 10 ter de la Ley 24.240. No es el mismo trámite ni tiene el mismo fundamento que el arrepentimiento del artículo 34. Hercules 3.5 implementa únicamente el botón de arrepentimiento solicitado. Si AJR Data comercializa servicios continuos o recurrentes a distancia, debe definirse e implementarse un proceso separado de baja, con identificación mínima, trazabilidad y ejecución operativa.

### Tablero Scrumban

`AgileWorkItem` no tiene FK hacia `ClientOrder` ni una asociación verificable entre pedido, proyecto y tareas. Por eso la Fase 1 registra la solicitud y su auditoría, pero **no detiene, elimina ni archiva tareas automáticamente**. Hacerlo a ciegas puede afectar trabajo ajeno.

Diseño previsto para una iteración posterior:

1. Asociar el pedido al proyecto y sus tareas mediante una FK nullable o una tabla de asociación, según cardinalidad real.
2. Exponer la relación desde el flujo de conversión de pedido en proyecto, con permisos y auditoría.
3. Suspender las tareas relacionadas mediante un estado explícito y reversible; no reutilizar `DONE`, no borrar el historial.
4. Guardar transición, actor, motivo, marca temporal y vínculo con el código de arrepentimiento.
5. Hacer la actualización operativa en una transacción coherente después de la revisión legal y comercial necesaria.

## Configuración y operación

- Aplicar las migraciones `0009_order_regret` y `0010_email_outbox` con `alembic upgrade head`.
- Mantener `SCHEDULER_ENABLED=true` en la instancia que ejecuta el worker.
- Configurar `EMAIL_BACKEND=smtp`, host, puerto, TLS, remitente y credenciales reales. `EMAIL_BACKEND=console` solo sirve para desarrollo/pruebas y no envía correos.
- Supervisar errores del scheduler y mensajes `PENDING` con antigüedad superior a 24 horas.
- Probar caída SMTP, reinicio del proceso, reintento, duplicados y confirmación por el mismo canal en staging.
