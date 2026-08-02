"""
Analiza la web del restaurante para detectar:
- Qué plataforma de reservas usa (si usa alguna)
- Si canaliza las reservas por WhatsApp
- Su nivel de digitalización
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_fixed

# Dominios de widgets de reserva de restauración. Detectarlos nos dice si el
# local ya tiene motor de reservas y con quién compite la propuesta.
_BOOKING_PLATFORMS = {
    "covermanager.com": "covermanager",
    "thefork.com": "thefork",
    "thefork.es": "thefork",
    "eltenedor.es": "thefork",
    "opentable.com": "opentable",
    "opentable.es": "opentable",
    "sevenrooms.com": "sevenrooms",
    "resy.com": "resy",
    "zenchef.com": "zenchef",
    "bookline.ai": "bookline",
    "restoo.es": "restoo",
    "simplybook.me": "simplybook",
    "mesa247.com": "other_platform",
    "quandoo.es": "other_platform",
    "resmio.com": "other_platform",
    "formitable.com": "other_platform",
    "tableo.com": "other_platform",
}

_BOOKING_KEYWORDS_ES = [
    "reservar mesa", "reserva online", "reservar online", "reserva tu mesa",
    "haz tu reserva", "reservar ahora", "book a table", "book now",
    "reservas online", "reserva de mesa", "pedir mesa",
]

_WHATSAPP_PATTERNS = [
    r"wa\.me/",
    r"api\.whatsapp\.com",
    r"whatsapp\.com/send",
    r"whatsapp",
]


@dataclass
class WebAnalysisResult:
    booking_platform: str = "unknown"
    has_online_booking: bool = False
    uses_whatsapp: bool = False
    digitalization_score: int = 0
    detected_booking_url: str | None = None
    error: str | None = None


def analyze_website(url: str, timeout: float = 10.0) -> WebAnalysisResult:
    if not url:
        return WebAnalysisResult(error="No URL provided")

    normalized = _normalize_url(url)

    try:
        html = _fetch_page(normalized, timeout)
    except Exception as exc:
        logger.debug(f"[WebAnalyzer] No se pudo obtener {url}: {exc}")
        return WebAnalysisResult(error=str(exc))

    return _analyze_html(html, normalized)


@retry(stop=stop_after_attempt(2), wait=wait_fixed(2))
def _fetch_page(url: str, timeout: float) -> str:
    with httpx.Client(
        timeout=timeout,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (compatible; prospecting-bot/1.0; +mailto:contact@example.com)"},
    ) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.text


def _analyze_html(html: str, url: str) -> WebAnalysisResult:
    result = WebAnalysisResult()
    soup = BeautifulSoup(html, "html.parser")
    full_text = soup.get_text(separator=" ").lower()

    # Check all links for known booking platforms
    for a in soup.find_all("a", href=True):
        href = a["href"].lower()
        for domain, platform_name in _BOOKING_PLATFORMS.items():
            if domain in href:
                result.booking_platform = platform_name
                result.has_online_booking = True
                result.detected_booking_url = a["href"]
                break
        if result.has_online_booking:
            break

    # Also check iframes and scripts
    if not result.has_online_booking:
        for tag in soup.find_all(["iframe", "script"], src=True):
            src = tag.get("src", "").lower()
            for domain, platform_name in _BOOKING_PLATFORMS.items():
                if domain in src:
                    result.booking_platform = platform_name
                    result.has_online_booking = True
                    break

    # Detect generic booking keywords
    if not result.has_online_booking:
        for kw in _BOOKING_KEYWORDS_ES:
            if kw in full_text:
                result.has_online_booking = True
                result.booking_platform = "none"  # has booking but no known platform
                break

    # Detect WhatsApp
    for pattern in _WHATSAPP_PATTERNS:
        if re.search(pattern, html, re.IGNORECASE):
            result.uses_whatsapp = True
            break

    # Simple digitalization score
    score = 0
    if result.has_online_booking:
        score += 40
    if result.uses_whatsapp:
        score += 20
    if soup.find("meta", attrs={"name": "viewport"}):
        score += 15  # mobile-friendly
    if soup.find_all("a", href=re.compile(r"instagram|facebook|twitter", re.I)):
        score += 15
    if soup.find("link", rel="canonical"):
        score += 10
    result.digitalization_score = min(score, 100)

    return result


def _normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path or '/'}"
