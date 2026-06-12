"""
Google Places API (Legacy) source.

Uses Text Search + Place Details endpoints.
Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

Rate limits: 600 QPM for Places API.
Cost: Text Search $17/1000, Place Details $17/1000 (basic fields).
Free monthly credit: $200 (~11,750 requests).
"""
from __future__ import annotations

import time
from typing import Any

import httpx
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import get_settings
from src.models.lead import LeadCreate
from src.sources.base import BaseSource
from src.utils.rate_limiter import RateLimiter

_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

_DETAIL_FIELDS = ",".join([
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "rating",
    "user_ratings_total",
    "opening_hours",
    "business_status",
    "url",
    "types",
    "address_components",
])

_CHAIN_KEYWORDS = [
    "eurostop", "franquicia", "tony&guy", "tony and guy", "supercuts",
    "salon llongueras", "llongueras", "pelu express", "klippan", "cabello express",
]


class GooglePlacesSource(BaseSource):
    source_name = "google_places"

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.google_places_api_key:
            raise ValueError("GOOGLE_PLACES_API_KEY no está configurada en .env")
        self._api_key = settings.google_places_api_key
        self._limiter = RateLimiter(delay_ms=settings.request_delay_ms)
        self._client = httpx.Client(timeout=15.0)

    def search(
        self,
        query: str,
        city: str,
        province: str = "",
        max_pages: int = 3,
        **kwargs,
    ) -> list[LeadCreate]:
        location_query = f"{query} {city}"
        if province and province.lower() not in city.lower():
            location_query += f" {province}"

        logger.info(f"[Google Places] Buscando: '{location_query}'")

        place_ids: list[str] = []
        next_token: str | None = None

        for page in range(max_pages):
            self._limiter.wait()
            results, next_token = self._text_search(location_query, next_token)
            place_ids.extend(results)
            logger.debug(f"  Página {page + 1}: {len(results)} resultados")
            if not next_token:
                break
            time.sleep(2)  # Google requires a short delay before using pagetoken

        logger.info(f"[Google Places] {len(place_ids)} lugares encontrados — obteniendo detalles...")

        leads: list[LeadCreate] = []
        for place_id in place_ids:
            self._limiter.wait()
            detail = self._get_details(place_id)
            if detail:
                lead = self._map_to_lead(detail, city, province)
                if lead:
                    leads.append(lead)

        logger.info(f"[Google Places] {len(leads)} leads válidos procesados.")
        return leads

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def _text_search(
        self, query: str, page_token: str | None = None
    ) -> tuple[list[str], str | None]:
        params: dict[str, Any] = {
            "query": query,
            "type": "hair_salon|beauty_salon",
            "language": "es",
            "region": "es",
            "key": self._api_key,
        }
        if page_token:
            params["pagetoken"] = page_token

        response = self._client.get(_TEXT_SEARCH_URL, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            logger.warning(f"[Google Places] Estado inesperado: {data.get('status')} — {data.get('error_message', '')}")
            return [], None

        place_ids = [r["place_id"] for r in data.get("results", [])]
        next_token = data.get("next_page_token")
        return place_ids, next_token

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def _get_details(self, place_id: str) -> dict | None:
        params = {
            "place_id": place_id,
            "fields": _DETAIL_FIELDS,
            "language": "es",
            "key": self._api_key,
        }
        response = self._client.get(_DETAILS_URL, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "OK":
            return None
        return data.get("result")

    def _map_to_lead(self, result: dict, city: str, province: str) -> LeadCreate | None:
        business_status = result.get("business_status", "")
        if business_status in ("CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"):
            logger.debug(f"  Ignorado (cerrado): {result.get('name')}")
            return None

        types = result.get("types", [])
        if not any(t in types for t in ("hair_salon", "beauty_salon", "barber_shop")):
            if "point_of_interest" not in types:
                logger.debug(f"  Ignorado (tipo no relevante): {result.get('name')} — {types}")
                return None

        name = result.get("name", "")
        address_components = result.get("address_components", [])
        detected_city, detected_province, postal_code = _extract_address_parts(address_components)

        hours_text = None
        if result.get("opening_hours"):
            periods = result["opening_hours"].get("weekday_text", [])
            hours_text = "; ".join(periods)

        estimated_size = _estimate_size(name, result.get("user_ratings_total", 0))

        return LeadCreate(
            name=name,
            address=result.get("formatted_address"),
            city=detected_city or city,
            province=detected_province or province,
            postal_code=postal_code,
            phone=result.get("formatted_phone_number"),
            website=result.get("website"),
            google_place_id=result.get("place_id"),
            google_maps_url=result.get("url"),
            rating=result.get("rating"),
            review_count=result.get("user_ratings_total"),
            hours_text=hours_text,
            source=self.source_name,
            estimated_size=estimated_size,
        )

    def close(self) -> None:
        self._client.close()


def _extract_address_parts(
    components: list[dict],
) -> tuple[str, str, str]:
    city = province = postal_code = ""
    for c in components:
        types = c.get("types", [])
        if "locality" in types:
            city = c.get("long_name", "")
        elif "administrative_area_level_2" in types:
            province = c.get("long_name", "")
        elif "postal_code" in types:
            postal_code = c.get("long_name", "")
    return city, province, postal_code


def _estimate_size(name: str, review_count: int) -> str:
    name_lower = name.lower()
    if any(k in name_lower for k in _CHAIN_KEYWORDS):
        return "large"
    if review_count > 200:
        return "medium"
    if review_count > 50:
        return "small"
    return "solo"
