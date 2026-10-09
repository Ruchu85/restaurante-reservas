"""
Vuelve a renderizar el texto de los borradores ya creados.

Se usa cuando cambia una plantilla y hay borradores en cola con la redacción
antigua. NO toca qué leads tienen borrador: reescribe los que ya existen, uno a
uno, con las plantillas actuales. Regenerar con `emails generate` /
`whatsapp generate` no sirve para esto, porque esos comandos saltan los leads
que ya tienen borrador — y borrarlos y volver a generarlos cambiaría el
conjunto de leads de la cola según los filtros que se usaran.

Solo actúa sobre borradores sin enviar. Uso:

    python regenerar_textos.py            # muestra qué cambiaría
    python regenerar_textos.py --aplicar  # lo escribe
"""
from __future__ import annotations

import sys

from src.config.settings import get_settings
from src.models.lead import LeadRead
from src.outreach.generator import generate_draft
from src.outreach.whatsapp_generator import generate_whatsapp_draft
from src.storage.database import get_session, init_db
from src.storage.db_models import EmailDraft, Lead, WhatsAppMessage

APLICAR = "--aplicar" in sys.argv
SOLO_EMAILS = "--solo-emails" in sys.argv


def main() -> None:
    init_db(get_settings().database_url)
    emails = whatsapps = 0

    with get_session() as session:
        for draft in session.query(EmailDraft).filter(EmailDraft.status == "draft").all():
            lead = session.get(Lead, draft.lead_id)
            if lead is None:
                continue
            nuevo = generate_draft(LeadRead.model_validate(lead))
            if nuevo is None or (nuevo.body_text == draft.body_text and nuevo.body_html == draft.body_html):
                continue
            emails += 1
            if APLICAR:
                draft.subject = nuevo.subject
                draft.body_text = nuevo.body_text
                draft.body_html = nuevo.body_html

        for msg in ([] if SOLO_EMAILS else session.query(WhatsAppMessage).filter(WhatsAppMessage.whatsapp_status == "draft").all()):
            lead = session.get(Lead, msg.lead_id)
            if lead is None:
                continue
            nuevo = generate_whatsapp_draft(LeadRead.model_validate(lead), require_mobile=False)
            if nuevo is None or nuevo.message_text == msg.message_text:
                continue
            whatsapps += 1
            if APLICAR:
                msg.message_text = nuevo.message_text
                # El enlace lleva el mensaje codificado en la URL: si no se
                # rehace, el texto del wa.me sigue siendo el antiguo.
                msg.wa_link = nuevo.wa_link

        if APLICAR:
            session.commit()

    verbo = "Actualizados" if APLICAR else "Cambiarían"
    print(f"{verbo}: {emails} emails, {whatsapps} WhatsApps")
    if not APLICAR:
        print("Repite con --aplicar para escribirlo.")


if __name__ == "__main__":
    main()
