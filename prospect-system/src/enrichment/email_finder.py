"""
Email discovery module.

Strategy:
1. Hunter.io API (if configured) — most reliable
2. Scrape the business website's contact page — legitimate (their public info)
3. Return None if nothing found

We only read publicly visible contact info the business itself has published.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_fixed

from src.config.settings import get_settings

_EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b"
)

_CONTACT_PAGE_PATHS = [
    "/contacto", "/contactar", "/contact", "/contact-us",
    "/sobre-nosotros", "/about", "/aviso-legal",
]

_EXCLUDED_EMAIL_DOMAINS = {
    "example.com", "test.com", "sentry.io", "w3.org", "schema.org",
    "google.com", "facebook.com", "instagram.com", "twitter.com",
}


def find_email(website: str | None, domain: str | None = None) -> str | None:
    """
    Try to find a public contact email for the business.
    Returns the email or None if not found.
    """
    settings = get_settings()

    # Try Hunter.io first if configured
    if settings.hunter_api_key and domain:
        email = _hunter_lookup(domain, settings.hunter_api_key)
        if email:
            logger.debug(f"[EmailFinder] Hunter.io encontró: {email}")
            return email

    # Fall back to website scraping
    if website:
        email = _scrape_website_email(website)
        if email:
            logger.debug(f"[EmailFinder] Scraping encontró: {email}")
            return email

    return None


def _hunter_lookup(domain: str, api_key: str) -> str | None:
    """Query Hunter.io Domain Search API."""
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                "https://api.hunter.io/v2/domain-search",
                params={"domain": domain, "api_key": api_key, "type": "personal"},
            )
            if response.status_code != 200:
                return None
            data = response.json()
            emails = data.get("data", {}).get("emails", [])
            if emails:
                return emails[0].get("value")
    except Exception as exc:
        logger.debug(f"[Hunter.io] Error: {exc}")
    return None


def _scrape_website_email(website: str) -> str | None:
    """Scrape the website (homepage + contact page) for a public email address."""
    base = _get_base_url(website)
    urls_to_check = [website] + [urljoin(base, path) for path in _CONTACT_PAGE_PATHS[:3]]

    for url in urls_to_check:
        try:
            html = _fetch_html(url)
            email = _extract_email_from_html(html)
            if email:
                return email
        except Exception:
            continue

    return None


@retry(stop=stop_after_attempt(2), wait=wait_fixed(2))
def _fetch_html(url: str) -> str:
    with httpx.Client(
        timeout=10.0,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (compatible; prospecting-bot/1.0)"},
    ) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.text


def _extract_email_from_html(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")

    # Check mailto links first (most reliable)
    for a in soup.find_all("a", href=re.compile(r"mailto:", re.I)):
        href = a["href"].replace("mailto:", "").strip().lower()
        email = href.split("?")[0]  # strip query params
        if _is_valid_email(email):
            return email

    # Fall back to regex scan of visible text
    text = soup.get_text()
    matches = _EMAIL_PATTERN.findall(text)
    for match in matches:
        if _is_valid_email(match.lower()):
            return match.lower()

    return None


def _is_valid_email(email: str) -> bool:
    if not _EMAIL_PATTERN.match(email):
        return False
    domain = email.split("@")[-1].lower()
    if domain in _EXCLUDED_EMAIL_DOMAINS:
        return False
    if domain.endswith((".png", ".jpg", ".gif", ".svg", ".css", ".js")):
        return False
    return True


def _get_base_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def extract_domain(website: str) -> str | None:
    try:
        if not website.startswith(("http://", "https://")):
            website = "https://" + website
        return urlparse(website).netloc.lstrip("www.")
    except Exception:
        return None
