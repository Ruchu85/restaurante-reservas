"""Email draft generator using Jinja2 templates."""
from __future__ import annotations

from pathlib import Path

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


def generate_draft(lead: LeadRead) -> EmailDraftCreate | None:
    """Generate a personalized email draft for a lead. Returns None if no email address."""
    if not lead.email:
        return None

    settings = get_settings()
    env = _get_env()

    ctx = {
        "lead": lead,
        "sender": {
            "name": settings.sender_name,
            "email": settings.sender_email,
        },
    }

    subject = env.get_template("email_subject.j2").render(**ctx).strip()
    body_text = env.get_template("email_body.j2").render(**ctx).strip()

    return EmailDraftCreate(
        lead_id=lead.id,
        subject=subject,
        body_text=body_text,
    )
