"""Envío de mails por SMTP (stdlib). Pensado para correr en BackgroundTasks.

Regla de oro: un problema con el mail NUNCA rompe la respuesta HTTP; se loguea y listo.
Si tu proveedor bloquea SMTP saliente (pasa en algunos planes gratuitos), reemplazá solo
`_deliver()` por una llamada a la API HTTP del proveedor: el resto no cambia.
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

BRAND = "#4f46e5"


# ----------------------------------------------------------------------- transporte
def _clean_header(value: str) -> str:
    """Saca saltos de línea (anti header-injection)."""
    return re.sub(r"[\r\n]+", " ", value).strip()


def _deliver(msg: EmailMessage) -> None:
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
    if not settings.SMTP_HOST:
        logger.info("SMTP no configurado: se omite el mail «%s».", _clean_header(subject))
        return
    sender = settings.SMTP_FROM or settings.SMTP_USER
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
