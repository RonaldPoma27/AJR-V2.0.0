"""Envío de mails (stdlib). Pensado para correr en BackgroundTasks.

Regla de oro: un problema con el mail NUNCA rompe la respuesta HTTP; se loguea y listo.

Transportes (EMAIL_BACKEND):
- "smtp":    envío real por SMTP.
- "console": mock, no manda nada y loguea el mail completo (desarrollo / pruebas).

Para un servicio externo (Resend, SendGrid, SES...) agregá otra función `_deliver_<nombre>(msg)`
y sumala al despacho de `_deliver()`: las plantillas y los llamadores no cambian. Si tu hosting
bloquea SMTP saliente (pasa en algunos planes gratuitos) es justo el caso para usarla.
"""
import logging
import re
import smtplib
import ssl
from email.message import EmailMessage
from html import escape
from typing import Any

from app.core.config import settings

logger = logging.getLogger("email")

BRAND = "#1d6ae5"


# ----------------------------------------------------------------------- transporte
def _clean_header(value: str) -> str:
    """Saca saltos de línea (anti header-injection)."""
    return re.sub(r"[\r\n]+", " ", value).strip()


def _deliver_console(msg: EmailMessage) -> None:
    body = msg.get_body(("plain",))
    logger.info(
        "[MAIL console] To: %s | Subject: %s\n%s",
        msg["To"],
        msg["Subject"],
        body.get_content() if body else "",
    )


def _deliver(msg: EmailMessage) -> None:
    if settings.EMAIL_BACKEND == "console":
        return _deliver_console(msg)
    return _deliver_smtp(msg)


def _deliver_smtp(msg: EmailMessage) -> None:
    mode = settings.SMTP_TLS.strip().lower()
    host, port = settings.SMTP_HOST or "", settings.SMTP_PORT
    if mode == "ssl":
        server: smtplib.SMTP = smtplib.SMTP_SSL(host, port, timeout=15, context=ssl.create_default_context())
    else:
        server = smtplib.SMTP(host, port, timeout=15)
    with server:
        if mode == "starttls":
            server.starttls(context=ssl.create_default_context())
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def send_email(
    to: str, subject: str, text: str, html: str | None = None, reply_to: str | None = None
) -> None:
    """Envía un mail. No lanza excepciones: loguea y sigue."""
    console = settings.EMAIL_BACKEND == "console"
    if not console and not settings.SMTP_HOST:
        logger.info("SMTP no configurado: se omite el mail «%s».", _clean_header(subject))
        return
    sender = settings.SMTP_FROM or settings.SMTP_USER or ("no-reply@ajrdata.local" if console else None)
    if not sender:
        logger.warning("Falta SMTP_FROM o SMTP_USER: se omite el mail «%s».", _clean_header(subject))
        return
    try:
        msg = EmailMessage()
        msg["From"] = _clean_header(f"AJR Data <{sender}>" if "<" not in sender else sender)
        msg["To"] = _clean_header(to)
        msg["Subject"] = _clean_header(subject)
        if reply_to:
            msg["Reply-To"] = _clean_header(reply_to)
        msg.set_content(text)
        if html:
            msg.add_alternative(html, subtype="html")
        _deliver(msg)
        logger.info("Mail enviado: «%s».", _clean_header(subject))
    except Exception:  # noqa: BLE001 - el mail nunca debe tirar abajo la request
        logger.exception("No se pudo enviar el mail «%s».", _clean_header(subject))


class EmailDeliveryError(RuntimeError):
    """El correo sensible no pudo enviarse de forma real y confirmable."""


def send_backup_email_code(to: str, code: str, *, expires_minutes: int) -> None:
    """Envía un código de seguridad por SMTP sin registrarlo en logs.

    Este flujo deliberadamente NO usa EMAIL_BACKEND=console: ese transporte registra los cuerpos
    completos de los mensajes y expondría el código. En ausencia de SMTP real, falla explícitamente.
    """
    if settings.EMAIL_BACKEND != "smtp":
        raise EmailDeliveryError("La verificación de correo requiere un transporte SMTP real.")
    if not settings.SMTP_HOST:
        raise EmailDeliveryError("SMTP no está configurado para la verificación de correo.")

    sender = settings.SMTP_FROM or settings.SMTP_USER
    if not sender:
        raise EmailDeliveryError("Falta configurar el remitente SMTP.")

    subject = "Código para verificar tu correo de respaldo — AJR Data"
    text_body = (
        "Recibimos una solicitud para configurar o cambiar el correo de respaldo de tu cuenta AJR Data.\n\n"
        f"Tu código de verificación es: {code}\n\n"
        f"El código vence en {expires_minutes} minutos y solo se puede usar una vez. "
        "Si no hiciste esta solicitud, podés ignorar este mensaje y revisar la seguridad de tu cuenta.\n\n"
        "Por seguridad, no compartas este código con nadie.\n\n— AJR Data"
    )
    html_body = (
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">'
        f'<h2 style="color:{BRAND}">Verificá tu correo de respaldo</h2>'
        '<p>Recibimos una solicitud para configurar o cambiar el correo de respaldo de tu cuenta AJR Data.</p>'
        '<p style="margin:24px 0;padding:18px;text-align:center;background:#f3f4f6;'
        'border-radius:12px;font-size:30px;font-weight:700;letter-spacing:8px">'
        f'{escape(code)}</p>'
        f'<p>El código vence en {int(expires_minutes)} minutos y solo se puede usar una vez.</p>'
        '<p>Si no hiciste esta solicitud, ignorá este mensaje y revisá la seguridad de tu cuenta.</p>'
        '<p style="color:#6b7280">Por seguridad, no compartas este código con nadie.</p>'
        '<p>— AJR Data</p></div>'
    )
    try:
        msg = EmailMessage()
        msg["From"] = _clean_header(f"AJR Data <{sender}>" if "<" not in sender else sender)
        msg["To"] = _clean_header(to)
        msg["Subject"] = _clean_header(subject)
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")
        _deliver_smtp(msg)
    except Exception as exc:  # noqa: BLE001 - nunca incluir body/destino/código en los logs.
        logger.warning("Falló el envío SMTP de un código de seguridad (%s).", type(exc).__name__)
        raise EmailDeliveryError("No se pudo entregar el código de verificación.") from None
    logger.info("Se envió un correo de verificación de seguridad.")


def send_backup_email_notice(to: str, *, action: str) -> None:
    """Avisa al correo principal sin enviar ni registrar datos sensibles en los logs.

    Como se trata de un aviso de seguridad, nunca usa el backend de consola: los destinatarios y
    cuerpos de mensajes no deben aparecer en logs de desarrollo. El fallo del aviso no revierte
    una operación de seguridad ya confirmada.
    """
    messages = {
        "verified": (
            "Se verificó un correo de respaldo para tu cuenta AJR Data.",
            "Si reconocés la operación, no necesitás hacer nada. Si no la reconocés, cambiá tu contraseña y contactá al equipo.",
        ),
        "changed": (
            "Se actualizó el correo de respaldo de tu cuenta AJR Data.",
            "Si reconocés la operación, no necesitás hacer nada. Si no la reconocés, cambiá tu contraseña y contactá al equipo.",
        ),
        "deleted": (
            "Se eliminó el correo de respaldo de tu cuenta AJR Data.",
            "Si no reconocés la operación, cambiá tu contraseña y contactá al equipo.",
        ),
    }
    if settings.EMAIL_BACKEND != "smtp" or not settings.SMTP_HOST:
        logger.info("Se omitió una notificación de seguridad porque SMTP real no está disponible.")
        return
    sender = settings.SMTP_FROM or settings.SMTP_USER
    if not sender:
        logger.warning("Se omitió una notificación de seguridad: remitente SMTP no configurado.")
        return

    title, outro = messages.get(action, messages["changed"])
    try:
        msg = EmailMessage()
        msg["From"] = _clean_header(f"AJR Data <{sender}>" if "<" not in sender else sender)
        msg["To"] = _clean_header(to)
        msg["Subject"] = _clean_header("Aviso de seguridad de AJR Data")
        msg.set_content(f"{title}\n\n{outro}\n\n— AJR Data")
        msg.add_alternative(_html(title, title, outro=outro), subtype="html")
        _deliver_smtp(msg)
    except Exception as exc:  # noqa: BLE001 - nunca registrar el destinatario ni el cuerpo.
        logger.warning("No se pudo enviar una notificación de seguridad (%s).", type(exc).__name__)
        return
    logger.info("Se envió una notificación de seguridad de cuenta.")


# ---------------------------------------------------------------------- plantillas
def _rows_text(rows: list[tuple[str, str]]) -> str:
    return "\n".join(f"{label}: {value}" for label, value in rows if value)


def _html(title: str, intro: str, rows: list[tuple[str, str]] | None = None, outro: str = "") -> str:
    table = ""
    if rows:
        cells = "".join(
            f'<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top">{escape(label)}</td>'
            f'<td style="padding:4px 0;white-space:pre-wrap">{escape(value)}</td></tr>'
            for label, value in rows
            if value
        )
        table = f'<table style="margin:16px 0;font-size:14px">{cells}</table>'
    return (
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">'
        f'<h2 style="color:{BRAND};margin-bottom:8px">{escape(title)}</h2>'
        f'<p style="font-size:15px;line-height:1.5">{escape(intro)}</p>{table}'
        f'<p style="font-size:14px;color:#6b7280">{escape(outro)}</p></div>'
    )


def _first_name(full_name: str) -> str:
    return full_name.split()[0] if full_name.split() else full_name


# --------------------------------------------------------------------------- pedidos
def send_order_emails(order: dict[str, Any]) -> None:
    """Mail al admin ("Nuevo pedido de proyecto") + auto-reply al cliente."""
    rows = [
        ("Empresa", order["company_name"]),
        ("Contacto", order["contact_name"]),
        ("Email", order["contact_email"]),
        ("Teléfono", order.get("contact_phone") or ""),
        ("Rubro", order["industry"]),
        ("Problema a resolver", order["problem_description"]),
    ]
    admin_email = settings.notify_email
    if admin_email:
        subject = "Nuevo pedido de proyecto"
        intro = f"{order['contact_name']} ({order['company_name']}) envió un pedido desde la web."
        send_email(
            admin_email,
            subject,
            f"{intro}\n\n{_rows_text(rows)}",
            _html(subject, intro, rows),
            reply_to=order["contact_email"],
        )

    name = _first_name(order["contact_name"])
    intro = f"¡Hola {name}! Recibimos tu solicitud en AJR Data, la revisaremos pronto."
    outro = "Te vamos a escribir a este mismo email. Si querés sumar información, respondé este mensaje."
    send_email(
        order["contact_email"],
        "Recibimos tu solicitud en AJR Data",
        f"{intro}\n\n{outro}\n\n— El equipo de AJR Data",
        _html("¡Gracias por escribirnos!", intro, outro=outro),
    )


# ----------------------------------------------------------------------- postulaciones
def send_application_emails(application: dict[str, Any]) -> None:
    """Mail al admin ("Nueva postulación") + auto-reply al candidato."""
    rows = [
        ("Nombre", application["full_name"]),
        ("Email", application["email"]),
        ("Teléfono", application.get("phone") or ""),
        ("Ciudad y país", application["location"]),
        ("Área de interés", application["area"]),
        ("Experiencia", application.get("experience_level") or ""),
        ("Disponibilidad", application.get("availability") or ""),
        ("LinkedIn", application.get("linkedin_url") or ""),
        ("GitHub / Portfolio", application.get("github_url") or ""),
        ("CV", application.get("cv_url") or ""),
        ("Por qué quiere sumarse", application["motivation"]),
    ]
    admin_email = settings.notify_email
    if admin_email:
        subject = "Nueva postulación"
        intro = f"{application['full_name']} se postuló para {application['area']}."
        send_email(
            admin_email,
            subject,
            f"{intro}\n\n{_rows_text(rows)}",
            _html(subject, intro, rows),
            reply_to=application["email"],
        )

    name = _first_name(application["full_name"])
    intro = f"¡Hola {name}! Recibimos tu postulación en AJR Data. Gracias por querer sumarte a la familia."
    outro = "La vamos a leer con atención y, si hay match, te escribimos para conocernos."
    send_email(
        application["email"],
        "Recibimos tu postulación en AJR Data",
        f"{intro}\n\n{outro}\n\n— El equipo de AJR Data",
        _html("¡Gracias por postularte!", intro, outro=outro),
    )


# ------------------------------------------------------ cambio de estado de un pedido
ORDER_STATUS_LABELS = {
    "nuevo": "Nuevo",
    "en_revision": "En revisión",
    "contactado": "Contactado",
    "finalizado": "Finalizado",
    "descartado": "Descartado",
}

_ORDER_STATUS_MESSAGES = {
    "nuevo": "Tu pedido volvió al estado «Nuevo» y está en la cola para ser revisado.",
    "en_revision": "Estamos revisando tu pedido. En breve te contamos los próximos pasos.",
    "contactado": "Ya nos pusimos en contacto con vos por los datos que nos dejaste. "
    "Si todavía no te llegó nada, revisá tu bandeja de spam o respondé este mail.",
    "finalizado": "Tu pedido quedó finalizado. ¡Gracias por confiar en AJR Data!",
    "descartado": "Cerramos tu pedido sin avanzar con el proyecto. Si creés que es un error "
    "o querés retomarlo, respondé este mail y lo vemos.",
}


def send_order_status_email(
    *, to: str, name: str, order_id: int, company_name: str, status: str
) -> None:
    """Avisa al dueño del pedido que cambió su estado (lo dispara un ADMIN o TECHNICIAN)."""
    label = ORDER_STATUS_LABELS.get(status, status)
    intro = f"¡Hola {_first_name(name)}! Tu pedido de {company_name} cambió de estado: {label}."
    detail = _ORDER_STATUS_MESSAGES.get(status, "")
    base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    link = f"{base}/cuenta/pedidos" if base else ""
    outro = detail + (f"\n\nPodés seguirlo en: {link}" if link else "")
    rows = [("Pedido", f"#{order_id} · {company_name}"), ("Estado", label)]
    send_email(
        to,
        f"Tu pedido #{order_id} está «{label}»",
        f"{intro}\n\n{outro}\n\n— El equipo de AJR Data",
        _html(f"Tu pedido está «{label}»", intro, rows, outro),
    )
