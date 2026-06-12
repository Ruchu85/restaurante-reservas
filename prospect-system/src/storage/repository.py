from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from src.models.lead import LeadCreate, LeadRead, EmailDraftCreate, EmailDraftRead
from src.storage.db_models import AuditLog, EmailDraft, Lead


class LeadRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, data: LeadCreate) -> LeadRead:
        lead = Lead(
            id=str(uuid.uuid4()),
            **data.model_dump(),
        )
        self._session.add(lead)
        self._session.commit()
        self._session.refresh(lead)
        self._audit("create", "lead", lead.id, data.model_dump())
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
        self._session.commit()
        self._session.refresh(lead)
        self._audit("update", "lead", lead_id, fields)
        return LeadRead.model_validate(lead)

    def mark_opted_out(self, lead_id: str) -> None:
        self.update(lead_id, status="opted_out", do_not_contact=True)
        self._audit("opt_out", "lead", lead_id, {})

    def count(self, status: Optional[str] = None) -> int:
        q = self._session.query(Lead)
        if status:
            q = q.filter(Lead.status == status)
        return q.count()

    def find_duplicate_by_name_city(self, name: str, city: str) -> Optional[Lead]:
        return (
            self._session.query(Lead)
            .filter(Lead.name.ilike(name), Lead.city.ilike(city))
            .first()
        )

    def _audit(self, action: str, entity_type: str, entity_id: str, data: dict) -> None:
        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            data=json.dumps(data, default=str),
        )
        self._session.add(log)
        self._session.commit()


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
