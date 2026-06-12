from src.dedup.deduplicator import normalize, deduplicate_batch
from src.models.lead import LeadCreate


def test_normalize_strips_accents():
    assert normalize("Peluquería") == "peluqueria"
    assert normalize("José María") == "jose maria"
    assert normalize("Málaga") == "malaga"


def test_normalize_lowercase():
    assert normalize("SALON DE BELLEZA") == "salon de belleza"


def test_deduplicate_by_place_id():
    leads = [
        LeadCreate(name="Salón A", city="Madrid", google_place_id="place_001", source="test"),
        LeadCreate(name="Salón A", city="Madrid", google_place_id="place_001", source="test"),
        LeadCreate(name="Salón B", city="Madrid", google_place_id="place_002", source="test"),
    ]
    result = deduplicate_batch(leads)
    assert len(result) == 2


def test_deduplicate_by_name_city():
    leads = [
        LeadCreate(name="Peluquería Sol", city="Sevilla", source="test"),
        LeadCreate(name="Peluquería Sol", city="Sevilla", source="test"),
        LeadCreate(name="Peluquería Luna", city="Sevilla", source="test"),
    ]
    result = deduplicate_batch(leads)
    assert len(result) == 2


def test_same_name_different_city_not_duplicate():
    leads = [
        LeadCreate(name="Peluquería Sol", city="Madrid", source="test"),
        LeadCreate(name="Peluquería Sol", city="Sevilla", source="test"),
    ]
    result = deduplicate_batch(leads)
    assert len(result) == 2


def test_empty_batch():
    assert deduplicate_batch([]) == []
