"""
Fuente de datos: Google Places API (New) — restaurantes en España.

Uses the modern Places API (New) endpoints:
  - Text Search: POST https://places.googleapis.com/v1/places:searchText
  - Auth via X-Goog-Api-Key header (not query param)
  - Field masks via X-Goog-FieldMask header

Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
Cost: $17/1000 requests. Free credit: $200/month (~11,750 requests free).
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

_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.businessStatus",
    "places.regularOpeningHours",
    "places.googleMapsUri",
    "places.addressComponents",
    "places.types",
    "nextPageToken",
])

# Cadenas y franquicias: tienen su propio software corporativo, no son cliente.
_CHAIN_KEYWORDS = [
    "mcdonald", "burger king", "kfc", "telepizza", "domino", "papa john",
    "vips", "ginos", "foster's hollywood", "fosters hollywood", "tgb",
    "goiko", "100 montaditos", "cervecería la sureña", "la sureña",
    "rodilla", "pans & company", "pans and company", "starbucks", "subway",
    "tony roma", "lateral", "grupo vips", "muerde la pasta", "tagliatella",
    "udon", "wok", "franquicia",
]

# Tipos de Google Places que consideramos restauración con servicio de mesa.
_ACCEPTED_TYPES = {
    "restaurant",
    "bar",
    "cafe",
    "meal_takeaway",
    "food",
    "bar_and_grill",
    "fine_dining_restaurant",
    "spanish_restaurant",
    "italian_restaurant",
    "japanese_restaurant",
    "seafood_restaurant",
    "steak_house",
    "pizza_restaurant",
    "tapas_restaurant",
    "brunch_restaurant",
}

# Tipos que descartamos aunque Google los mezcle con "restaurant".
_EXCLUDED_TYPES = {
    "lodging",
    "hotel",
    "gas_station",
    "supermarket",
    "convenience_store",
    "shopping_mall",
    "night_club",
}


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

        leads: list[LeadCreate] = []
        next_token: str | None = None

        for page in range(max_pages):
            self._limiter.wait()
            places, next_token = self._text_search(location_query, next_token)

            for place in places:
                lead = self._map_to_lead(place, city, province)
                if lead:
                    leads.append(lead)

            logger.debug(f"  Página {page + 1}: {len(places)} resultados")

            if not next_token:
                break
            time.sleep(2)

        logger.info(f"[Google Places] {len(leads)} leads válidos procesados.")
        return leads

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def _text_search(
        self, query: str, page_token: str | None = None
    ) -> tuple[list[dict], str | None]:
        body: dict[str, Any] = {
            "textQuery": query,
            "languageCode": "es",
            "regionCode": "ES",
            "maxResultCount": 20,
        }
        if page_token:
            body["pageToken"] = page_token

        response = self._client.post(
            _TEXT_SEARCH_URL,
            headers={
                "X-Goog-Api-Key": self._api_key,
                "X-Goog-FieldMask": _FIELD_MASK,
                "Content-Type": "application/json",
            },
            json=body,
        )

        if response.status_code != 200:
            logger.warning(
                f"[Google Places] HTTP {response.status_code}: {response.text[:200]}"
            )
            response.raise_for_status()

        data = response.json()
        places = data.get("places", [])
        next_token = data.get("nextPageToken")
        return places, next_token

    def _map_to_lead(self, place: dict, city: str, province: str) -> LeadCreate | None:
        business_status = place.get("businessStatus", "")
        if business_status in ("CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"):
            return None

        types = set(place.get("types", []))
        if types & _EXCLUDED_TYPES:
            return None
        if not (types & _ACCEPTED_TYPES):
            return None

        name = place.get("displayName", {}).get("text", "")
        if not name:
            return None

        address_components = place.get("addressComponents", [])
        detected_city, detected_province, postal_code = _extract_address_parts(address_components)

        hours_text = None
        opening_hours = place.get("regularOpeningHours", {})
        if opening_hours:
            descriptions = opening_hours.get("weekdayDescriptions", [])
            hours_text = "; ".join(descriptions)

        review_count = place.get("userRatingCount", 0)
        estimated_size = _estimate_size(name, review_count)

        return LeadCreate(
            name=name,
            address=place.get("formattedAddress"),
            city=detected_city or city,
            province=detected_province or province,
            postal_code=postal_code,
            phone=place.get("nationalPhoneNumber"),
            website=place.get("websiteUri"),
            google_place_id=place.get("id"),
            google_maps_url=place.get("googleMapsUri"),
            rating=place.get("rating"),
            review_count=review_count,
            hours_text=hours_text,
            source=self.source_name,
            estimated_size=estimated_size,
        )

    def close(self) -> None:
        self._client.close()


def _extract_address_parts(components: list[dict]) -> tuple[str, str, str]:
    city = province = postal_code = ""
    for c in components:
        types = c.get("types", [])
        long_name = c.get("longText", "") or c.get("long_name", "")
        if "locality" in types:
            city = long_name
        elif "administrative_area_level_2" in types:
            province = long_name
        elif "postal_code" in types:
            postal_code = long_name
    return city, province, postal_code


def _estimate_size(name: str, review_count: int) -> str:
    """
    Tamaño estimado a partir del volumen de reseñas.

    Los umbrales son más altos que en otros sectores porque un restaurante
    medio acumula muchas más reseñas que, por ejemplo, una peluquería.
    """
    if any(k in name.lower() for k in _CHAIN_KEYWORDS):
        return "large"
    if review_count > 1000:
        return "medium"
    if review_count > 250:
        return "small"
    return "solo"
