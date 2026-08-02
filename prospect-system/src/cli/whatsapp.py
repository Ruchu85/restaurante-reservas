"""
Comandos de outreach por WhatsApp.

Flujo completo:

    run.bat whatsapp provinces          # ver cobertura por provincia
    run.bat whatsapp generate           # crear borradores (solo móviles)
    run.bat whatsapp review             # aprobar uno a uno
    run.bat whatsapp export             # HTML agrupado por provincia
    …enviar desde el HTML…
    run.bat whatsapp mark-sent --ids …  # sincronizar el estado

Por qué solo móviles: en España los fijos (8xx/9xx) no pueden registrar una
cuenta de WhatsApp, así que generar mensajes para ellos es tiempo perdido.
No existe ninguna API pública y legítima que confirme si un número concreto
está dado de alta en WhatsApp, de modo que el prefijo es el mejor filtro
disponible sin enviar mensajes a ciegas.
"""
from __future__ import annotations

from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from src.config.settings import get_settings
from src.enrichment.phone_finder import is_spanish_mobile
from src.outreach.whatsapp_exporter import export_whatsapp_csv, export_whatsapp_html
from src.outreach.whatsapp_generator import generate_whatsapp_draft
from src.storage.database import get_session, init_db
from src.storage.repository import LeadRepository, WhatsAppMessageRepository
from src.utils.geo import SPAIN_PROVINCES
from src.utils.logger import setup_logger

whatsapp_app = typer.Typer(help="Gestión de mensajes de WhatsApp de outreach.")
console = Console()


def _bootstrap() -> None:
    settings = get_settings()
    setup_logger(settings.log_level, settings.log_file)
    init_db(settings.database_url)


# ──────────────────────────────────────────────────────────────────────
# provinces
# ──────────────────────────────────────────────────────────────────────

@whatsapp_app.command("provinces")
def whatsapp_provinces() -> None:
    """Muestra la cobertura de teléfonos por provincia."""
    _bootstrap()

    with get_session() as session:
        leads = LeadRepository(session).list(limit=100_000)

    if not leads:
        console.print("[yellow]No hay leads todavía. Ejecuta primero 'prospect'.[/yellow]")
        return

    stats: dict[str, dict[str, int]] = {}
    for lead in leads:
        province = (lead.province or "").strip() or "Sin provincia"
        row = stats.setdefault(province, {"total": 0, "movil": 0, "fijo": 0, "sin": 0})
        row["total"] += 1
        if not lead.phone:
            row["sin"] += 1
        elif is_spanish_mobile(lead.phone):
            row["movil"] += 1
        else:
            row["fijo"] += 1

    known = {p.name for p in SPAIN_PROVINCES}

    table = Table(title="Leads por provincia", show_header=True, header_style="bold green")
    table.add_column("Provincia", style="cyan")
    table.add_column("Leads", justify="right")
    table.add_column("Móvil (WhatsApp)", justify="right", style="green")
    table.add_column("Solo fijo", justify="right", style="yellow")
    table.add_column("Sin teléfono", justify="right", style="red")

    for province in sorted(stats, key=lambda p: -stats[p]["total"]):
        row = stats[province]
        label = province if province in known or province == "Sin provincia" else f"{province} (?)"
        table.add_row(label, str(row["total"]), str(row["movil"]), str(row["fijo"]), str(row["sin"]))

    totals = {key: sum(r[key] for r in stats.values()) for key in ("total", "movil", "fijo", "sin")}
    table.add_section()
    table.add_row(
        "[bold]TOTAL[/bold]",
        f"[bold]{totals['total']}[/bold]",
        f"[bold]{totals['movil']}[/bold]",
        f"[bold]{totals['fijo']}[/bold]",
        f"[bold]{totals['sin']}[/bold]",
    )
    console.print(table)
    console.print(
        "\n[dim]Solo los móviles (6xx/7xx) pueden recibir WhatsApp: "
        "los fijos españoles (8xx/9xx) no admiten cuenta.[/dim]"
    )


# ──────────────────────────────────────────────────────────────────────
# generate
# ──────────────────────────────────────────────────────────────────────

@whatsapp_app.command("generate")
def whatsapp_generate(
    min_score: int = typer.Option(40, help="Score mínimo para generar mensaje"),
    limit: int = typer.Option(500, help="Máximo de mensajes a generar"),
    province: Optional[str] = typer.Option(None, help="Filtrar por provincia. Ej: 'Madrid'"),
    city: Optional[str] = typer.Option(None, help="Filtrar por ciudad"),
    include_landlines: bool = typer.Option(
        False, "--include-landlines", help="Incluir fijos (no tienen WhatsApp)"
    ),
) -> None:
    """Genera borradores de WhatsApp para los leads con teléfono móvil."""
    _bootstrap()

    with get_session() as session:
        # Los leads que ya tienen borrador se excluyen en la propia consulta, y
        # los fijos se filtran en SQL: así `limit` cuenta leads realmente
        # contactables. Antes se recortaba primero y se filtraba después, de
        # modo que pedir 500 daba ~150 mensajes y, al reejecutar, cero.
        already = WhatsAppMessageRepository(session).lead_ids_with_active_draft()

        leads = LeadRepository(session).list(
            has_phone=True,
            mobile_only=not include_landlines,
            exclude_ids=already,
            min_score=min_score,
            limit=limit,
            province=province,
            city=city,
        )

    if not leads:
        console.print(
            f"[yellow]No hay leads nuevos con teléfono"
            f"{' móvil' if not include_landlines else ''} y score ≥ {min_score}.[/yellow]"
        )
        return

    console.print(f"\n[bold cyan]Generando mensajes para {len(leads)} lead(s)…[/bold cyan]")

    generated = skipped = 0

    with get_session() as session:
        wa_repo = WhatsAppMessageRepository(session)

        for lead in leads:
            if lead.do_not_contact:
                skipped += 1
                continue

            draft = generate_whatsapp_draft(lead, require_mobile=not include_landlines)
            if draft:
                wa_repo.create(draft)
                generated += 1
            else:
                skipped += 1

    console.print(f"[bold green]✓ {generated} mensajes generados ({skipped} omitidos).[/bold green]")
    console.print("[dim]Revísalos con 'whatsapp review' y expórtalos con 'whatsapp export'.[/dim]")


# ──────────────────────────────────────────────────────────────────────
# review
# ──────────────────────────────────────────────────────────────────────

@whatsapp_app.command("review")
def whatsapp_review(limit: int = typer.Option(20, help="Mensajes a revisar")) -> None:
    """Revisa y aprueba los borradores uno a uno."""
    _bootstrap()

    with get_session() as session:
        drafts = WhatsAppMessageRepository(session).list_by_status("draft", limit=limit)

    if not drafts:
        console.print("[yellow]No hay mensajes pendientes de revisión.[/yellow]")
        return

    console.print(f"\n[bold]Revisando {len(drafts)} mensaje(s) de WhatsApp[/bold]\n")
    approved = discarded = skipped = 0

    with get_session() as session:
        wa_repo = WhatsAppMessageRepository(session)
        leads_by_id = LeadRepository(session).get_many([d.lead_id for d in drafts])

        for index, draft in enumerate(drafts, 1):
            lead = leads_by_id.get(draft.lead_id)
            if not lead:
                continue

            console.rule(f"[{index}/{len(drafts)}] {lead.name} — Score: {lead.score}")
            console.print(f"[cyan]Teléfono:[/cyan] {draft.phone}")
            console.print(f"[cyan]Ubicación:[/cyan] {lead.city or '–'} ({lead.province or '–'})")
            console.print(f"\n{draft.message_text}\n")

            action = (
                typer.prompt(
                    "¿Qué hacer? [a]probar / [s]altar / [d]escartar / [q]salir",
                    default="a",
                )
                .strip()
                .lower()
            )

            if action == "a":
                wa_repo.update_status(draft.id, "approved")
                approved += 1
            elif action == "d":
                wa_repo.update_status(draft.id, "discarded")
                discarded += 1
            elif action == "q":
                break
            else:
                skipped += 1

    console.print(
        f"\n[bold green]✓ {approved} aprobados, {discarded} descartados, "
        f"{skipped} saltados.[/bold green]"
    )


# ──────────────────────────────────────────────────────────────────────
# export
# ──────────────────────────────────────────────────────────────────────

@whatsapp_app.command("export")
def whatsapp_export(
    output: str = typer.Option("data/whatsapp_por_provincias.html", help="Ruta del HTML"),
    csv_output: str = typer.Option("data/whatsapp_links.csv", help="Ruta del CSV"),
    all_drafts: bool = typer.Option(False, "--all", help="Incluir también los no aprobados"),
    province: Optional[str] = typer.Option(None, help="Exportar solo una provincia"),
) -> None:
    """Exporta los mensajes como página HTML agrupada por provincia."""
    _bootstrap()

    with get_session() as session:
        wa_repo = WhatsAppMessageRepository(session)
        lead_repo = LeadRepository(session)

        drafts = (
            [d for d in wa_repo.list_all() if d.whatsapp_status != "discarded"]
            if all_drafts
            else wa_repo.list_by_status("approved")
        )

        if not drafts:
            label = "mensajes" if all_drafts else "mensajes aprobados"
            console.print(
                f"[yellow]No hay {label}. Ejecuta 'whatsapp generate' "
                "y 'whatsapp review' primero.[/yellow]"
            )
            return

        # Una sola consulta para todos los leads en lugar de una por borrador.
        leads_by_id = lead_repo.get_many([d.lead_id for d in drafts])

        items = []
        for draft in drafts:
            lead = leads_by_id.get(draft.lead_id)
            if not lead:
                continue
            if province and (lead.province or "").lower() != province.lower():
                continue
            items.append({"draft": draft, "lead": lead})

    if not items:
        console.print(f"[yellow]Ningún mensaje para la provincia '{province}'.[/yellow]")
        return

    total = export_whatsapp_html(items, output)
    export_whatsapp_csv(items, csv_output)

    console.print(f"\n[bold green]✓ {total} mensajes exportados.[/bold green]")
    console.print(f"  HTML → [cyan]{output}[/cyan]")
    console.print(f"  CSV  → [cyan]{csv_output}[/cyan]")
    console.print("\n[bold]Cómo usarlo:[/bold]")
    console.print("  1. Abre el HTML en el navegador (con WhatsApp Web ya iniciado)")
    console.print("  2. Pulsa [green]'Abrir en WhatsApp'[/green] fila a fila y envía")
    console.print("  3. Al terminar: 'Copiar IDs enviados' → [cyan]whatsapp mark-sent --ids …[/cyan]")


# ──────────────────────────────────────────────────────────────────────
# mark-sent / discard-landlines / stats
# ──────────────────────────────────────────────────────────────────────

@whatsapp_app.command("mark-sent")
def whatsapp_mark_sent(
    ids: str = typer.Option(..., help="IDs separados por comas (los copia el HTML)"),
) -> None:
    """Marca como enviados los mensajes cuyos IDs copiaste desde el HTML."""
    _bootstrap()

    wanted = [i.strip() for i in ids.split(",") if i.strip()]
    if not wanted:
        console.print("[yellow]No has indicado ningún ID.[/yellow]")
        return

    marked = missing = 0
    with get_session() as session:
        wa_repo = WhatsAppMessageRepository(session)
        for msg_id in wanted:
            if wa_repo.update_status(msg_id, "sent"):
                marked += 1
            else:
                missing += 1

    console.print(f"[bold green]✓ {marked} mensajes marcados como enviados.[/bold green]")
    if missing:
        console.print(f"[yellow]  {missing} ID(s) no encontrados.[/yellow]")


@whatsapp_app.command("discard-landlines")
def whatsapp_discard_landlines() -> None:
    """Descarta los borradores creados para teléfonos fijos (sin WhatsApp)."""
    _bootstrap()

    discarded = kept = 0
    with get_session() as session:
        wa_repo = WhatsAppMessageRepository(session)
        for draft in wa_repo.list_all():
            if draft.whatsapp_status == "discarded":
                continue
            if is_spanish_mobile(draft.phone):
                kept += 1
            else:
                wa_repo.update_status(draft.id, "discarded")
                discarded += 1

    console.print(f"[bold green]✓ {discarded} mensajes de fijos descartados.[/bold green]")
    console.print(f"[bold cyan]  {kept} mensajes de móviles conservados.[/bold cyan]")


@whatsapp_app.command("stats")
def whatsapp_stats() -> None:
    """Estado de la campaña de WhatsApp."""
    _bootstrap()

    with get_session() as session:
        repo = LeadRepository(session)
        wa_repo = WhatsAppMessageRepository(session)

        with_phone = repo.list(has_phone=True, limit=100_000)
        mobiles = [l for l in with_phone if is_spanish_mobile(l.phone)]

        table = Table(title="Campaña de WhatsApp", show_header=True, header_style="bold green")
        table.add_column("Métrica", style="cyan")
        table.add_column("Total", justify="right")
        table.add_row("Leads con teléfono", str(len(with_phone)))
        table.add_row("… móviles (contactables)", str(len(mobiles)))
        table.add_row("… fijos (sin WhatsApp)", str(len(with_phone) - len(mobiles)))
        table.add_section()
        table.add_row("Mensajes en borrador", str(wa_repo.count_by_status("draft")))
        table.add_row("Mensajes aprobados", str(wa_repo.count_by_status("approved")))
        table.add_row("Mensajes enviados", str(wa_repo.count_by_status("sent")))
        table.add_row("Mensajes descartados", str(wa_repo.count_by_status("discarded")))

        console.print(table)
