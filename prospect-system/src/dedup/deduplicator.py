"""
Deduplication module.

Primary key: google_place_id (guaranteed unique if present).
Fallback: fuzzy match on (normalized_name, city).
"""
from __future__ import annotations

import re
import unicodedata

from src.models.lead import LeadCreate
from src.storage.repository import LeadRepository


def normalize(text: str) -> str:
    """Normalize text for comparison: lowercase, strip accents, remove punctuation."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    ascii_text = nfkd.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9 ]", "", ascii_text).strip()


def is_duplicate(lead: LeadCreate, repo: LeadRepository) -> bool:
    """
    Returns True if this lead is already in the database.
    Checks google_place_id first, then name+city fuzzy match.
    """
    # Exact match on Google Place ID (most reliable)
    if lead.google_place_id:
        if repo.exists_by_place_id(lead.google_place_id):
            return True

    # Fuzzy match on name + city
    if lead.name and lead.city:
        norm_name = normalize(lead.name)
        norm_city = normalize(lead.city)
        existing = repo.find_duplicate_by_name_city(norm_name, norm_city)
        if existing:
            return True

    return False


def deduplicate_batch(leads: list[LeadCreate]) -> list[LeadCreate]:
    """Remove duplicates within a batch (before DB insertion)."""
    seen: set[tuple[str, str]] = set()
    unique: list[LeadCreate] = []

    for lead in leads:
        # Use place_id as the primary dedup key within a batch
        if lead.google_place_id:
            key = ("place_id", lead.google_place_id)
        else:
            key = ("name_city", f"{normalize(lead.name or '')}|{normalize(lead.city or '')}")

        if key not in seen:
            seen.add(key)
            unique.append(lead)

    return unique
