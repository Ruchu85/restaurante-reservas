"""
Email sender module.

IMPORTANT: DRY_RUN=true is the hardcoded default.
Emails are NEVER sent unless the user explicitly sets DRY_RUN=false in .env
AND email_sending_configured() returns True.

This is enforced at two levels:
  1. Settings.assert_not_dry_run() raises an exception if dry_run=True.
  2. send() logs the email content and returns early without calling any API.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import httpx
from loguru import logger

from src.config.settings import get_settings
from src.models.lead import EmailDraftRead
from src.storage.database import get_session
from src.storage.repository import EmailDraftRepository, LeadRepository

_BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


class EmailSender:
    def __init__(self) -> None:
        self._settings = get_settings()

    def send_approved_drafts(self, limit: int | None = None) -> dict:
        """
        Send all approved email drafts.
        In dry-run mode: logs the emails without sending and returns summary.
        """
        settings = self._settings
        max_to_send = limit or settings.daily_email_limit

        with get_session() as session:
            draft_repo = EmailDraftRepository(session)
            lead_repo = LeadRepository(session)
            drafts = draft_repo.list_by_status("approved", limit=max_to_send)

            if not drafts:
                logger.info("[Sender] No hay borradores aprobados para enviar.")
                return {"sent": 0, "dry_run": settings.dry_run, "errors": 0}

            if settings.dry_run:
                logger.warning(
                    f"[Sender] DRY-RUN: mostrando {len(drafts)} emails SIN enviar. "
                    "Establece DRY_RUN=false en .env para envío real."
                )
                for draft in drafts:
                    lead = lead_repo.get_by_id(draft.lead_id)
                    _log_dry_run_email(draft, lead)
                return {"sent": 0, "dry_run": True, "total": len(drafts)}

            settings.assert_not_dry_run()

            if not settings.email_sending_configured():
                raise RuntimeError(
                    "Configura BREVO_API_KEY o SMTP en .env para enviar emails reales."
                )

            sent = errors = 0
            for draft in drafts:
                lead = lead_repo.get_by_id(draft.lead_id)
                if not lead or not lead.email:
                    continue
                if lead.do_not_contact:
                    logger.info(f"[Sender] Omitido (opt-out): {lead.name}")
                    continue

                try:
                    self._send_via_brevo(draft, lead.email)
                    draft_repo.update_status(draft.id, "sent", sent_at=datetime.utcnow())
                    lead_repo.update(lead.id, status="email_sent", email_sent_at=datetime.utcnow(), email_status="sent")
                    logger.success(f"[Sender] Enviado a {lead.name} <{lead.email}>")
                    sent += 1
                except Exception as exc:
                    logger.error(f"[Sender] Error enviando a {lead.email}: {exc}")
                    draft_repo.update_status(draft.id, "error", error_message=str(exc))
                    errors += 1

            return {"sent": sent, "dry_run": False, "errors": errors}

    def _send_via_brevo(self, draft: EmailDraftRead, to_email: str) -> None:
        settings = self._settings
        payload = {
            "sender": {"name": settings.sender_name, "email": settings.sender_email},
            "to": [{"email": to_email}],
            "replyTo": {"email": settings.sender_reply_to or settings.sender_email},
            "subject": draft.subject,
            "textContent": draft.body_text,
        }
        if draft.body_html:
            payload["htmlContent"] = draft.body_html

        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                _BREVO_SEND_URL,
                headers={
                    "api-key": settings.brevo_api_key,
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload),
            )
            response.raise_for_status()


def _log_dry_run_email(draft: EmailDraftRead, lead) -> None:
    name = lead.name if lead else "Desconocido"
    email = lead.email if lead else "sin email"
    logger.info(
        f"\n{'─' * 60}\n"
        f"[DRY-RUN] Para: {name} <{email}>\n"
        f"Asunto: {draft.subject}\n"
        f"{'─' * 60}\n"
        f"{draft.body_text}\n"
        f"{'─' * 60}"
    )
