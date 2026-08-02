"""Generador de borradores de WhatsApp con plantillas Jinja2."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader

from src.config.settings import get_settings
from src.enrichment.phone_finder import is_spanish_mobile, normalize_phone
from src.models.lead import LeadRead, WhatsAppDraftCreate

_TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"


def _get_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=False,  # texto plano para WhatsApp
        trim_blocks=True,
        lstrip_blocks=True,
    )


def generate_whatsapp_draft(
    lead: LeadRead,
    *,
    require_mobile: bool = True,
) -> WhatsAppDraftCreate | None:
    """
    Genera un mensaje personalizado para el lead.

    Devuelve None si no hay teléfono o si, con `require_mobile`, el número es un
    fijo (que no puede tener WhatsApp).
    """
    phone = normalize_phone(lead.phone) or (lead.phone or "").strip()
    if not phone:
        return None
    if require_mobile and not is_spanish_mobile(phone):
        return None

    settings = get_settings()
    env = _get_env()

    message_text = (
        env.get_template("whatsapp_message.j2")
        .render(
            lead=lead,
            sender={"name": settings.sender_name, "landing_url": settings.landing_url},
        )
        .strip()
    )

    return WhatsAppDraftCreate(
        lead_id=lead.id,
        phone=phone,
        message_text=message_text,
        wa_link=build_wa_link(phone, message_text),
    )


def build_wa_link(phone: str, message: str) -> str:
    """Enlace wa.me con el mensaje ya codificado en la URL."""
    clean = "".join(ch for ch in phone if ch.isdigit())
    return f"https://wa.me/{clean}?text={quote(message)}"
