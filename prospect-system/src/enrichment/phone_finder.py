"""
Descubrimiento y normalización de teléfonos públicos del negocio.

Estrategia:
 1. Usar el teléfono que ya venga de Google Places.
 2. Rascar enlaces `tel:` de la web del negocio — es la fuente más fiable.
 3. Como último recurso, buscar patrones de teléfono español en el texto visible.

Solo se lee información de contacto que el propio negocio ha publicado.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_fixed

# Teléfono español de 9 dígitos con separadores libres entre cifras: cubre
# "600112233", "600 11 22 33", "600-11-22-33" y "+34 600 112 233" por igual.
# Los grupos de 3-3-3 no valen: en España se escribe también 3-2-2-2.
_PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+34|0034)?[ .\-]?\d(?:[ .\-]?\d){8}(?!\d)")

# Páginas donde los restaurantes suelen publicar el teléfono de reservas.
_CONTACT_PAGE_PATHS = [
    "/contacto",
    "/reservas",
    "/contactar",
    "/contact",
    "/reservar",
    "/sobre-nosotros",
]


def find_phone(website: str | None) -> str | None:
    """
    Busca un teléfono público del negocio.
    Devuelve E.164 (+34XXXXXXXXX) o None.
    """
    if not website:
        return None
    return _scrape_website_phone(website)


def _scrape_website_phone(website: str) -> str | None:
    base = _get_base_url(website)
    urls_to_check = [website] + [urljoin(base, path) for path in _CONTACT_PAGE_PATHS[:3]]

    # Se prefiere un móvil (tiene WhatsApp) sobre un fijo, pero si solo hay fijo
    # se devuelve igualmente: sirve para llamar.
    fallback: str | None = None

    for url in urls_to_check:
        try:
            phone = _extract_phone_from_html(_fetch_html(url))
        except Exception:
            continue
        if not phone:
            continue
        if is_spanish_mobile(phone):
            return phone
        fallback = fallback or phone

    return fallback


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


def _extract_phone_from_html(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")

    # Los enlaces tel: son la fuente más fiable.
    candidates: list[str] = []
    for a in soup.find_all("a", href=re.compile(r"^tel:", re.I)):
        raw = a.get("href", "").replace("tel:", "").strip()
        normalized = normalize_phone(raw)
        if normalized:
            candidates.append(normalized)

    # Barrido por texto visible como respaldo.
    if not candidates:
        text = soup.get_text(separator=" ")
        for match in _PHONE_PATTERN.finditer(text):
            normalized = normalize_phone(match.group(0))
            if normalized:
                candidates.append(normalized)

    if not candidates:
        return None

    # Preferir móvil: es el único que puede recibir WhatsApp.
    for phone in candidates:
        if is_spanish_mobile(phone):
            return phone
    return candidates[0]


def normalize_phone(raw: str | None) -> str | None:
    """Quita separadores, valida 9 dígitos españoles y devuelve +34XXXXXXXXX."""
    if not raw:
        return None
    digits = re.sub(r"[\s\-.()]", "", raw)
    digits = re.sub(r"^(\+34|0034|34)", "", digits)
    if len(digits) == 9 and digits[0] in "6789":
        return f"+34{digits}"
    return None


def is_spanish_mobile(phone: str | None) -> bool:
    """
    True si es un móvil español (6xx o 7xx).

    Es la heurística que usamos para descartar los números SIN WhatsApp: en
    España, los fijos (8xx/9xx) no pueden tener cuenta de WhatsApp, mientras que
    prácticamente cualquier móvil sí. No hay ninguna API pública y legítima que
    confirme si un número concreto está registrado en WhatsApp, así que este
    filtro es lo más fiable que se puede hacer sin enviar mensajes a ciegas.
    """
    if not phone:
        return False
    digits = re.sub(r"[\s\-.()+]", "", phone)
    digits = re.sub(r"^34", "", digits)
    return len(digits) == 9 and digits[0] in "67"


def _get_base_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"
