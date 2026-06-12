"""
Lead scoring engine.

Score range: 0–100.
A higher score means a better prospect for our appointment management app.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from src.models.lead import LeadRead, LeadScore

_CHAIN_KEYWORDS = [
    "eurostop", "franquicia", "tony&guy", "tony and guy", "supercuts",
    "llongueras", "klippan", "pelu express", "cadena", "franquicia",
]

_ADVANCED_PLATFORMS = {"booksy", "treatwell", "fresha", "acuity", "mindbody"}
_BASIC_PLATFORMS = {"simplybook", "calendly", "reservio", "other_platform"}


@dataclass
class _Factors:
    # Positive
    active_business_good_rating: int = 15
    many_reviews: int = 10
    no_online_booking: int = 20
    uses_whatsapp_for_bookings: int = 20
    no_website_or_basic_web: int = 15
    independent_local: int = 10
    has_email: int = 5
    active_social_no_booking: int = 10

    # Negative
    already_has_advanced_platform: int = -30
    chain_or_franchise: int = -35
    closed_or_inactive: int = -60
    no_email_found: int = -10
    incomplete_data: int = -5
    large_size: int = -20


def score_lead(lead: LeadRead) -> LeadScore:
    points = 0
    reasons: list[str] = []
    f = _Factors()

    # --- Positive factors ---

    if lead.rating and lead.rating >= 4.0 and not lead.has_online_booking:
        points += f.active_business_good_rating
        reasons.append(f"+{f.active_business_good_rating}: buena valoración ({lead.rating}★) sin reserva online")

    if lead.review_count and lead.review_count >= 30:
        points += f.many_reviews
        reasons.append(f"+{f.many_reviews}: negocio activo ({lead.review_count} reseñas)")
    elif lead.review_count and lead.review_count >= 10:
        half = f.many_reviews // 2
        points += half
        reasons.append(f"+{half}: reseñas moderadas ({lead.review_count})")

    if not lead.has_online_booking:
        points += f.no_online_booking
        reasons.append(f"+{f.no_online_booking}: sin sistema de reservas online detectado")

    if lead.uses_whatsapp:
        points += f.uses_whatsapp_for_bookings
        reasons.append(f"+{f.uses_whatsapp_for_bookings}: usa WhatsApp para citas (pain point claro)")

    if not lead.website:
        points += f.no_website_or_basic_web
        reasons.append(f"+{f.no_website_or_basic_web}: sin página web — bajo nivel de digitalización")

    if lead.social_instagram and not lead.has_online_booking:
        points += f.active_social_no_booking
        reasons.append(f"+{f.active_social_no_booking}: Instagram activo pero sin reservas online")

    if lead.email:
        points += f.has_email
        reasons.append(f"+{f.has_email}: email de contacto disponible")

    if _is_independent(lead.name):
        points += f.independent_local
        reasons.append(f"+{f.independent_local}: negocio local independiente")

    # --- Negative factors ---

    if lead.booking_platform and lead.booking_platform in _ADVANCED_PLATFORMS:
        points += f.already_has_advanced_platform
        reasons.append(f"{f.already_has_advanced_platform}: ya usa plataforma avanzada ({lead.booking_platform})")

    if _is_chain(lead.name, lead.estimated_size):
        points += f.chain_or_franchise
        reasons.append(f"{f.chain_or_franchise}: posible cadena o franquicia")

    if lead.estimated_size == "large":
        points += f.large_size
        reasons.append(f"{f.large_size}: negocio grande (no es target principal)")

    if not lead.email:
        points += f.no_email_found
        reasons.append(f"{f.no_email_found}: email no encontrado")

    if _is_incomplete(lead):
        points += f.incomplete_data
        reasons.append(f"{f.incomplete_data}: datos incompletos")

    final_score = max(0, min(100, points))
    return LeadScore(score=final_score, reasons=reasons)


def _is_independent(name: str) -> bool:
    if not name:
        return True
    return not any(k in name.lower() for k in _CHAIN_KEYWORDS)


def _is_chain(name: str, size: str | None) -> bool:
    if not name:
        return False
    name_lower = name.lower()
    if any(k in name_lower for k in _CHAIN_KEYWORDS):
        return True
    if size == "large":
        return True
    return False


def _is_incomplete(lead: LeadRead) -> bool:
    missing = sum([
        not lead.phone,
        not lead.city,
        not lead.address,
    ])
    return missing >= 2
