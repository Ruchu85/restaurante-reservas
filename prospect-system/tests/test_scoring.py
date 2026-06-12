from datetime import datetime
import json

import pytest

from src.models.lead import LeadRead
from src.scoring.scorer import score_lead


def _make_lead(**kwargs) -> LeadRead:
    defaults = {
        "id": "test-id",
        "name": "Peluquería Test",
        "city": "Madrid",
        "province": "Madrid",
        "source": "test",
        "score": 0,
        "status": "new",
        "do_not_contact": False,
        "has_online_booking": False,
        "booking_platform": "unknown",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    defaults.update(kwargs)
    return LeadRead(**defaults)


def test_high_score_ideal_prospect():
    lead = _make_lead(
        rating=4.5,
        review_count=80,
        has_online_booking=False,
        uses_whatsapp=True,
        email="info@test.com",
        website=None,
        estimated_size="small",
    )
    result = score_lead(lead)
    assert result.score >= 70, f"Esperaba ≥70, obtuvo {result.score}"
    assert len(result.reasons) > 0


def test_low_score_already_has_platform():
    lead = _make_lead(
        rating=4.0,
        review_count=200,
        has_online_booking=True,
        booking_platform="treatwell",
        email="info@test.com",
        estimated_size="medium",
    )
    result = score_lead(lead)
    assert result.score < 50, f"Esperaba <50 por tener Treatwell, obtuvo {result.score}"


def test_penalty_chain():
    lead = _make_lead(
        name="Eurostop Peluquería",
        estimated_size="large",
        has_online_booking=True,
        booking_platform="booksy",
    )
    result = score_lead(lead)
    assert result.score < 30, f"Cadena debería tener score muy bajo, obtuvo {result.score}"


def test_no_email_penalty():
    result_no_email = score_lead(_make_lead(
        rating=4.5,
        review_count=50,
        has_online_booking=False,
        email=None,
    ))
    result_with_email = score_lead(_make_lead(
        rating=4.5,
        review_count=50,
        has_online_booking=False,
        email="info@test.com",
    ))
    assert result_with_email.score > result_no_email.score


def test_score_bounded():
    lead = _make_lead(
        rating=5.0,
        review_count=1000,
        has_online_booking=False,
        uses_whatsapp=True,
        email="info@test.com",
        website=None,
        social_instagram="https://instagram.com/test",
        estimated_size="solo",
    )
    result = score_lead(lead)
    assert 0 <= result.score <= 100


def test_reasons_not_empty():
    lead = _make_lead(rating=4.0, review_count=30)
    result = score_lead(lead)
    assert isinstance(result.reasons, list)
    assert len(result.reasons) > 0
