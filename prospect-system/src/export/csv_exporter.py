from __future__ import annotations

import csv
import json
from pathlib import Path

from src.models.lead import LeadRead
from src.storage.repository import LeadRepository

_CSV_FIELDS = [
    "id", "name", "city", "province", "community",
    "address", "postal_code", "phone", "email", "website",
    "rating", "review_count", "booking_platform", "has_online_booking",
    "uses_whatsapp", "estimated_size", "social_instagram", "social_facebook",
    "score", "score_reasons_summary", "status", "source",
    "google_maps_url", "created_at",
]


def export_to_csv(
    repo: LeadRepository,
    output_path: str,
    status: str | None = None,
    min_score: int = 0,
) -> int:
    leads = repo.list(status=status, min_score=min_score, limit=10_000)
    if not leads:
        return 0

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for lead in leads:
            writer.writerow(_lead_to_row(lead))

    return len(leads)


def _lead_to_row(lead: LeadRead) -> dict:
    reasons_summary = ""
    if lead.score_reasons:
        try:
            reasons_list = json.loads(lead.score_reasons)
            reasons_summary = " | ".join(reasons_list)
        except (json.JSONDecodeError, TypeError):
            reasons_summary = str(lead.score_reasons)

    return {
        "id": lead.id,
        "name": lead.name,
        "city": lead.city or "",
        "province": lead.province or "",
        "community": lead.community or "",
        "address": lead.address or "",
        "postal_code": lead.postal_code or "",
        "phone": lead.phone or "",
        "email": lead.email or "",
        "website": lead.website or "",
        "rating": lead.rating or "",
        "review_count": lead.review_count or "",
        "booking_platform": lead.booking_platform or "",
        "has_online_booking": "Sí" if lead.has_online_booking else "No",
        "uses_whatsapp": "Sí" if lead.uses_whatsapp else ("No" if lead.uses_whatsapp is False else ""),
        "estimated_size": lead.estimated_size or "",
        "social_instagram": lead.social_instagram or "",
        "social_facebook": lead.social_facebook or "",
        "score": lead.score,
        "score_reasons_summary": reasons_summary,
        "status": lead.status,
        "source": lead.source,
        "google_maps_url": lead.google_maps_url or "",
        "created_at": lead.created_at.isoformat() if lead.created_at else "",
    }
