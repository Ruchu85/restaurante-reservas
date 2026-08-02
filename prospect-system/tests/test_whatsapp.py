"""Tests del flujo de outreach por WhatsApp."""
from __future__ import annotations

import pytest

from src.enrichment.phone_finder import (
    _extract_phone_from_html,
    is_spanish_mobile,
    normalize_phone,
)
from src.models.lead import LeadCreate
from src.outreach.whatsapp_exporter import export_whatsapp_csv, export_whatsapp_html, slugify
from src.outreach.whatsapp_generator import build_wa_link, generate_whatsapp_draft
from src.storage.database import get_session, init_db
from src.storage.repository import LeadRepository, WhatsAppMessageRepository


# ──────────────────────────────────────────────────────────────────────
# Normalización de teléfonos
# ──────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "raw",
    [
        "600112233",
        "600 11 22 33",
        "600-11-22-33",
        "+34600112233",
        "+34 600 11 22 33",
        "0034600112233",
        "34600112233",
        "(600) 112233",
    ],
)
def test_normalize_phone_unifica_variantes(raw):
    """Todas las formas de escribir el mismo número dan la misma clave."""
    assert normalize_phone(raw) == "+34600112233"


@pytest.mark.parametrize("raw", [None, "", "123", "60011223", "12345678901234"])
def test_normalize_phone_rechaza_invalidos(raw):
    assert normalize_phone(raw) is None


@pytest.mark.parametrize("phone", ["600112233", "+34612345678", "722334455", "799887766"])
def test_is_spanish_mobile_acepta_moviles(phone):
    assert is_spanish_mobile(phone) is True


@pytest.mark.parametrize("phone", ["911223344", "+34800123456", "987654321", None, ""])
def test_is_spanish_mobile_rechaza_fijos(phone):
    """Los fijos españoles (8xx/9xx) no pueden tener cuenta de WhatsApp."""
    assert is_spanish_mobile(phone) is False


# ──────────────────────────────────────────────────────────────────────
# Extracción de teléfono desde la web del negocio
# ──────────────────────────────────────────────────────────────────────

def test_extrae_telefono_de_enlace_tel():
    html = '<html><body><a href="tel:+34600112233">Llámanos</a></body></html>'
    assert _extract_phone_from_html(html) == "+34600112233"


def test_extrae_telefono_del_texto_visible():
    html = "<html><body><p>Reservas: 600 11 22 33</p></body></html>"
    assert _extract_phone_from_html(html) == "+34600112233"


def test_prefiere_movil_sobre_fijo():
    """Si la web publica fijo y móvil, nos quedamos con el que tiene WhatsApp."""
    html = (
        '<html><body>'
        '<a href="tel:911223344">Fijo</a>'
        '<a href="tel:600112233">Móvil</a>'
        "</body></html>"
    )
    assert _extract_phone_from_html(html) == "+34600112233"


def test_devuelve_fijo_si_es_lo_unico_que_hay():
    html = '<html><body><a href="tel:911223344">Fijo</a></body></html>'
    assert _extract_phone_from_html(html) == "+34911223344"


def test_sin_telefono_devuelve_none():
    assert _extract_phone_from_html("<html><body><p>Sin datos</p></body></html>") is None


# ──────────────────────────────────────────────────────────────────────
# Slug de provincia (anclas del HTML)
# ──────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "province,expected",
    [
        ("A Coruña", "a-coruna"),
        ("Álava", "alava"),
        ("Santa Cruz de Tenerife", "santa-cruz-de-tenerife"),
        ("Madrid", "madrid"),
        ("", "sin-provincia"),
    ],
)
def test_slugify_provincias(province, expected):
    assert slugify(province) == expected


# ──────────────────────────────────────────────────────────────────────
# Enlace wa.me
# ──────────────────────────────────────────────────────────────────────

def test_build_wa_link_codifica_el_mensaje():
    link = build_wa_link("+34600112233", "Hola, ¿qué tal?")
    assert link.startswith("https://wa.me/34600112233?text=")
    assert " " not in link
    assert "%C2%BF" in link  # el "¿" va codificado


# ──────────────────────────────────────────────────────────────────────
# Flujo completo sobre una base de datos temporal
# ──────────────────────────────────────────────────────────────────────

SEED = [
    ("Casa Pepe", "Madrid", "Madrid", "600112233"),
    ("Bar Manolo", "Móstoles", "Madrid", "911223344"),        # fijo
    ("Marisquería O Porto", "A Coruña", "A Coruña", "722334455"),
    ("Taberna Sin Tel", "Sevilla", "Sevilla", None),
]


@pytest.fixture
def db(tmp_path):
    init_db(f"sqlite:///{(tmp_path / 'leads.db').as_posix()}")
    with get_session() as session:
        repo = LeadRepository(session)
        for name, city, province, phone in SEED:
            repo.create(
                LeadCreate(
                    name=name,
                    city=city,
                    province=province,
                    phone=normalize_phone(phone) if phone else None,
                    score=70,
                    source="test",
                )
            )
    return tmp_path


def test_filtro_has_phone(db):
    with get_session() as session:
        repo = LeadRepository(session)
        assert len(repo.list(has_phone=True, limit=100)) == 3
        assert len(repo.list(has_phone=False, limit=100)) == 1


def test_filtro_mobile_only_en_sql(db):
    """El fijo debe quedar fuera ya en la consulta, no después."""
    with get_session() as session:
        leads = LeadRepository(session).list(has_phone=True, mobile_only=True, limit=100)

    assert len(leads) == 2
    assert all(is_spanish_mobile(l.phone) for l in leads)


def test_limit_cuenta_leads_contactables(db):
    """
    Con `limit=2` y filtro de móvil se deben devolver 2 MÓVILES.

    Antes se recortaba a `limit` y luego se descartaban los fijos, así que
    pedir N mensajes daba bastantes menos.
    """
    with get_session() as session:
        leads = LeadRepository(session).list(has_phone=True, mobile_only=True, limit=2)

    assert len(leads) == 2
    assert all(is_spanish_mobile(l.phone) for l in leads)


def test_exclude_ids_deja_alcanzables_los_siguientes(db):
    with get_session() as session:
        repo = LeadRepository(session)
        first = repo.list(has_phone=True, mobile_only=True, limit=1)
        assert len(first) == 1

        # Segunda pasada excluyendo el anterior: debe traer uno distinto,
        # no repetir el mismo por estar mejor puntuado.
        second = repo.list(
            has_phone=True, mobile_only=True, limit=1, exclude_ids={first[0].id}
        )

    assert len(second) == 1
    assert second[0].id != first[0].id


def test_get_many_evita_el_n_mas_1(db):
    with get_session() as session:
        repo = LeadRepository(session)
        ids = [l.id for l in repo.list(limit=100)]
        found = repo.get_many(ids)

    assert len(found) == len(SEED)
    assert all(i in found for i in ids)
    # Ids repetidos o inexistentes no rompen nada.
    with get_session() as session:
        mixed = LeadRepository(session).get_many([ids[0], ids[0], "no-existe"])
    assert set(mixed) == {ids[0]}


def test_get_many_con_lista_vacia(db):
    with get_session() as session:
        assert LeadRepository(session).get_many([]) == {}


def test_auditoria_se_persiste_con_la_operacion(db):
    """El registro de auditoría debe sobrevivir al cierre de la sesión."""
    from src.storage.db_models import AuditLog

    with get_session() as session:
        LeadRepository(session).create(
            LeadCreate(name="Auditado", city="Madrid", province="Madrid", source="test")
        )

    with get_session() as session:
        logs = session.query(AuditLog).filter(AuditLog.action == "create").all()

    assert len(logs) >= 1


def test_solo_se_generan_mensajes_para_moviles(db):
    with get_session() as session:
        repo = LeadRepository(session)
        wa_repo = WhatsAppMessageRepository(session)
        for lead in repo.list(has_phone=True, limit=100):
            draft = generate_whatsapp_draft(lead)
            if draft:
                wa_repo.create(draft)

        drafts = wa_repo.list_all()

    assert len(drafts) == 2, "el fijo no debería generar mensaje"
    assert all(is_spanish_mobile(d.phone) for d in drafts)


def test_include_landlines_permite_forzar_fijos(db):
    with get_session() as session:
        lead = next(
            l for l in LeadRepository(session).list(has_phone=True, limit=100)
            if not is_spanish_mobile(l.phone)
        )
    assert generate_whatsapp_draft(lead) is None
    assert generate_whatsapp_draft(lead, require_mobile=False) is not None


def test_dedupe_en_una_sola_consulta(db):
    with get_session() as session:
        repo = LeadRepository(session)
        wa_repo = WhatsAppMessageRepository(session)
        for lead in repo.list(has_phone=True, limit=100):
            draft = generate_whatsapp_draft(lead)
            if draft:
                wa_repo.create(draft)

        already = wa_repo.lead_ids_with_active_draft()

    assert len(already) == 2


def test_export_html_agrupa_por_provincia(db, tmp_path):
    with get_session() as session:
        repo = LeadRepository(session)
        wa_repo = WhatsAppMessageRepository(session)
        for lead in repo.list(has_phone=True, limit=100):
            draft = generate_whatsapp_draft(lead)
            if draft:
                wa_repo.create(draft)

        items = [
            {"draft": d, "lead": repo.get_by_id(d.lead_id)} for d in wa_repo.list_all()
        ]

    html_path = tmp_path / "wa.html"
    csv_path = tmp_path / "wa.csv"
    assert export_whatsapp_html(items, str(html_path)) == 2
    assert export_whatsapp_csv(items, str(csv_path)) == 2

    html = html_path.read_text(encoding="utf-8")
    assert 'id="madrid"' in html
    assert 'id="a-coruna"' in html
    assert "https://wa.me/34600112233?text=" in html
    assert "localStorage" in html, "el HTML debe recordar qué se ha enviado"
    assert "911223344" not in html, "un fijo se ha colado en la exportación"

    csv_content = csv_path.read_text(encoding="utf-8-sig")
    assert "A Coruña" in csv_content


def test_mark_sent_actualiza_estado_y_fecha(db):
    with get_session() as session:
        repo = LeadRepository(session)
        wa_repo = WhatsAppMessageRepository(session)
        lead = repo.list(has_phone=True, limit=1)[0]
        draft = wa_repo.create(generate_whatsapp_draft(lead))

        assert wa_repo.update_status(draft.id, "sent") is True
        assert wa_repo.update_status("id-inexistente", "sent") is False
        assert wa_repo.count_by_status("sent") == 1
        assert wa_repo.get(draft.id).sent_at is not None


def test_html_escapa_nombres_con_html(db, tmp_path):
    """Un nombre con etiquetas no debe romper (ni inyectar en) la página."""
    with get_session() as session:
        repo = LeadRepository(session)
        wa_repo = WhatsAppMessageRepository(session)
        lead = repo.create(
            LeadCreate(
                name='Bar <script>alert("x")</script>',
                city="Madrid",
                province="Madrid",
                phone="+34600999888",
                score=70,
                source="test",
            )
        )
        draft = wa_repo.create(generate_whatsapp_draft(lead))
        items = [{"draft": draft, "lead": lead}]

    path = tmp_path / "escape.html"
    export_whatsapp_html(items, str(path))
    html = path.read_text(encoding="utf-8")

    assert "<script>alert" not in html
    assert "&lt;script&gt;" in html
