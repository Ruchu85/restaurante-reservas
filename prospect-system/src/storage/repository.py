from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.models.lead import (
    LeadCreate, LeadRead,
    EmailDraftCreate, EmailDraftRead,
    WhatsAppDraftCreate, WhatsAppDraftRead,
)
from src.storage.db_models import AuditLog, EmailDraft, Lead, WhatsAppMessage


class LeadRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, data: LeadCreate) -> LeadRead:
        lead = Lead(
            id=str(uuid.uuid4()),
            **data.model_dump(),
        )
        self._session.add(lead)
        self._session.flush()  # asigna el id sin cerrar la transacción
        self._audit("create", "lead", lead.id, data.model_dump())
        self._session.commit()
        self._session.refresh(lead)
        return LeadRead.model_validate(lead)

    def get_by_id(self, lead_id: str) -> Optional[LeadRead]:
        lead = self._session.get(Lead, lead_id)
        return LeadRead.model_validate(lead) if lead else None

    def get_by_place_id(self, place_id: str) -> Optional[Lead]:
        return (
            self._session.query(Lead)
            .filter(Lead.google_place_id == place_id)
            .first()
        )

    def exists_by_place_id(self, place_id: str) -> bool:
        return self.get_by_place_id(place_id) is not None

    def list(
        self,
        status: Optional[str] = None,
        min_score: int = 0,
        city: Optional[str] = None,
        province: Optional[str] = None,
        has_email: Optional[bool] = None,
        has_phone: Optional[bool] = None,
        mobile_only: bool = False,
        exclude_ids: Optional[set[str]] = None,
        do_not_contact: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[LeadRead]:
        q = self._session.query(Lead).filter(Lead.do_not_contact == do_not_contact)

        if status:
            q = q.filter(Lead.status == status)
        if min_score:
            q = q.filter(Lead.score >= min_score)
        if city:
            q = q.filter(Lead.city.ilike(f"%{city}%"))
        if province:
            q = q.filter(Lead.province.ilike(f"%{province}%"))
        if has_email is True:
            q = q.filter(Lead.email.isnot(None))
        elif has_email is False:
            q = q.filter(Lead.email.is_(None))
        if has_phone is True:
            q = q.filter(Lead.phone.isnot(None), Lead.phone != "")
        elif has_phone is False:
            q = q.filter((Lead.phone.is_(None)) | (Lead.phone == ""))

        # Solo móviles españoles (6xx/7xx): son los únicos con WhatsApp.
        # Se filtra en SQL para que `limit` cuente leads CONTACTABLES; si no,
        # pedir 500 devolvía 500 leads de los que solo ~150 eran útiles.
        if mobile_only:
            q = q.filter(
                or_(
                    Lead.phone.like("+346%"),
                    Lead.phone.like("+347%"),
                    Lead.phone.like("6%"),
                    Lead.phone.like("7%"),
                )
            )

        # Excluir los que ya tienen borrador, también en SQL: si no, al reejecutar
        # el `limit` se consumía con los mismos leads de siempre y los del final
        # de la lista eran inalcanzables.
        if exclude_ids:
            q = q.filter(Lead.id.notin_(list(exclude_ids)))

        q = q.order_by(Lead.score.desc()).offset(offset).limit(limit)
        return [LeadRead.model_validate(l) for l in q.all()]

    def update(self, lead_id: str, **fields) -> Optional[LeadRead]:
        lead = self._session.get(Lead, lead_id)
        if not lead:
            return None
        for k, v in fields.items():
            if hasattr(lead, k):
                setattr(lead, k, v)
        lead.updated_at = datetime.utcnow()
        self._audit("update", "lead", lead_id, fields)
        self._session.commit()
        self._session.refresh(lead)
        return LeadRead.model_validate(lead)

    def mark_opted_out(self, lead_id: str) -> None:
        self.update(lead_id, status="opted_out", do_not_contact=True)
        self._audit("opt_out", "lead", lead_id, {})
        self._session.commit()

    def count(self, status: Optional[str] = None) -> int:
        q = self._session.query(Lead)
        if status:
            q = q.filter(Lead.status == status)
        return q.count()

    def get_many(self, lead_ids: list[str]) -> dict[str, LeadRead]:
        """
        Varios leads por id en una sola consulta.

        Exportar 1000 mensajes hacía 1000 SELECT (uno por borrador); ahora se
        resuelve en lotes.
        """
        if not lead_ids:
            return {}

        result: dict[str, LeadRead] = {}
        unique = list(dict.fromkeys(lead_ids))
        CHUNK = 500  # SQLite limita el número de parámetros por consulta
        for i in range(0, len(unique), CHUNK):
            rows = (
                self._session.query(Lead)
                .filter(Lead.id.in_(unique[i : i + CHUNK]))
                .all()
            )
            for lead in rows:
                result[lead.id] = LeadRead.model_validate(lead)
        return result

    def find_duplicate_by_name_city(self, name: str, city: str) -> Optional[Lead]:
        return (
            self._session.query(Lead)
            .filter(Lead.name.ilike(name), Lead.city.ilike(city))
            .first()
        )

    def _audit(self, action: str, entity_type: str, entity_id: str, data: dict) -> None:
        """
        Registra la operación en la misma transacción que la propia operación.

        Antes hacía su propio `commit()`, así que cada alta de lead costaba dos
        commits: en una prospección masiva eso domina el tiempo total.
        """
        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            data=json.dumps(data, default=str),
        )
        self._session.add(log)
        self._session.flush()


class EmailDraftRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, data: EmailDraftCreate) -> EmailDraftRead:
        draft = EmailDraft(id=str(uuid.uuid4()), **data.model_dump())
        self._session.add(draft)
        self._session.commit()
        self._session.refresh(draft)
        return EmailDraftRead.model_validate(draft)

    def get_by_lead(self, lead_id: str) -> list[EmailDraftRead]:
        drafts = (
            self._session.query(EmailDraft)
            .filter(EmailDraft.lead_id == lead_id)
            .order_by(EmailDraft.created_at.desc())
            .all()
        )
        return [EmailDraftRead.model_validate(d) for d in drafts]

    def list_by_status(self, status: str, limit: int = 100) -> list[EmailDraftRead]:
        drafts = (
            self._session.query(EmailDraft)
            .filter(EmailDraft.status == status)
            .limit(limit)
            .all()
        )
        return [EmailDraftRead.model_validate(d) for d in drafts]

    def update_status(self, draft_id: str, status: str, **extra) -> None:
        draft = self._session.get(EmailDraft, draft_id)
        if not draft:
            return
        draft.status = status
        for k, v in extra.items():
            if hasattr(draft, k):
                setattr(draft, k, v)
        self._session.commit()


class WhatsAppMessageRepository:
    """Borradores de WhatsApp: uno por lead, con su estado de envío."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, data: WhatsAppDraftCreate) -> WhatsAppDraftRead:
        msg = WhatsAppMessage(id=str(uuid.uuid4()), **data.model_dump())
        self._session.add(msg)
        self._session.commit()
        self._session.refresh(msg)
        return WhatsAppDraftRead.model_validate(msg)

    def get(self, msg_id: str) -> Optional[WhatsAppDraftRead]:
        msg = self._session.get(WhatsAppMessage, msg_id)
        return WhatsAppDraftRead.model_validate(msg) if msg else None

    def get_by_lead(self, lead_id: str) -> list[WhatsAppDraftRead]:
        msgs = (
            self._session.query(WhatsAppMessage)
            .filter(WhatsAppMessage.lead_id == lead_id)
            .order_by(WhatsAppMessage.created_at.desc())
            .all()
        )
        return [WhatsAppDraftRead.model_validate(m) for m in msgs]

    def lead_ids_with_active_draft(self) -> set[str]:
        """
        Leads que ya tienen un borrador vivo (no descartado).

        Se resuelve en una sola consulta: comprobarlo lead a lead hacía una
        query por lead y dominaba el tiempo de `whatsapp generate`.
        """
        rows = (
            self._session.query(WhatsAppMessage.lead_id)
            .filter(WhatsAppMessage.whatsapp_status != "discarded")
            .distinct()
            .all()
        )
        return {row[0] for row in rows}

    def list_by_status(self, status: str, limit: int = 1000) -> list[WhatsAppDraftRead]:
        msgs = (
            self._session.query(WhatsAppMessage)
            .filter(WhatsAppMessage.whatsapp_status == status)
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(limit)
            .all()
        )
        return [WhatsAppDraftRead.model_validate(m) for m in msgs]

    def list_all(self, limit: int = 10_000) -> list[WhatsAppDraftRead]:
        msgs = (
            self._session.query(WhatsAppMessage)
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(limit)
            .all()
        )
        return [WhatsAppDraftRead.model_validate(m) for m in msgs]

    def update_status(self, msg_id: str, status: str, **extra) -> bool:
        msg = self._session.get(WhatsAppMessage, msg_id)
        if not msg:
            return False
        msg.whatsapp_status = status
        if status == "sent" and msg.sent_at is None:
            msg.sent_at = datetime.utcnow()
        for k, v in extra.items():
            if hasattr(msg, k):
                setattr(msg, k, v)
        self._session.commit()
        return True

    def count_by_status(self, status: str) -> int:
        return (
            self._session.query(WhatsAppMessage)
            .filter(WhatsAppMessage.whatsapp_status == status)
            .count()
        )
