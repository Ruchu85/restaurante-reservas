"""Email draft generator using Jinja2 templates."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader, select_autoescape

from src.config.settings import get_settings
from src.models.lead import EmailDraftCreate, LeadRead

_TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"


def _get_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def enlaces_personalizados(lead: LeadRead, base: str) -> dict[str, str]:
    """Enlaces a la web con el nombre del restaurante y la campaña en la URL.

    `?r=` hace que la portada diga «Preparado para <restaurante>» y precarga el
    formulario; `utm_*` viaja hasta el aviso que llega al enviar el formulario,
    así se sabe qué correo funcionó. El nombre se limita a 60 caracteres porque
    es lo que admite la web.
    """
    etiqueta = "utm_source=email&utm_medium=frio&utm_campaign=oct26"
    nombre = quote(lead.name.strip()[:60], safe="")
    base = base.rstrip("/")
    return {
        "personal": f"{base}/?r={nombre}&{etiqueta}",
        "calc": f"{base}/calculadora?r={nombre}&{etiqueta}",
    }


def generate_draft(lead: LeadRead) -> EmailDraftCreate | None:
    """Generate a personalized email draft for a lead. Returns None if no email address."""
    if not lead.email:
        return None

    settings = get_settings()
    env = _get_env()

    ctx = {
        "lead": lead,
        "links": enlaces_personalizados(lead, settings.landing_url),
        "sender": {
            "name": settings.sender_name,
            "email": settings.sender_email,
            "product_name": settings.product_name,
            "landing_url": settings.landing_url,
            "demo_app_url": settings.demo_app_url,
            "video_url": settings.video_url,
            "product_website": settings.product_website,
        },
    }

    subject = env.get_template("email_subject.j2").render(**ctx).strip()
    body_text = env.get_template("email_body.j2").render(**ctx).strip()
    body_html = env.get_template("email_body_html.j2").render(**ctx).strip()

    return EmailDraftCreate(
        lead_id=lead.id,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
    )
