"""
Prospect System — CLI entrypoint
Usage: python main.py --help
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

import typer
from loguru import logger
from rich.console import Console
from rich.table import Table

# Ensure src/ is importable when running from project root
sys.path.insert(0, str(Path(__file__).parent))

from src.config.settings import get_settings
from src.dedup.deduplicator import deduplicate_batch, is_duplicate
from src.enrichment.email_finder import extract_domain, find_email
from src.enrichment.web_analyzer import analyze_website
from src.export.csv_exporter import export_to_csv
from src.models.lead import LeadStatus
from src.outreach.generator import generate_draft
from src.outreach.sender import EmailSender
from src.scoring.scorer import score_lead
from src.storage.database import get_session, init_db
from src.storage.repository import EmailDraftRepository, LeadRepository
from src.utils.geo import resolve_location
from src.utils.logger import setup_logger
from src.utils.rate_limiter import RateLimiter

app = typer.Typer(
    name="prospect",
    help="Sistema de prospección de peluquerías en España.",
    add_completion=False,
)
emails_app = typer.Typer(help="Gestión de emails de outreach.")
app.add_typer(emails_app, name="emails")

console = Console()


def _bootstrap() -> None:
    settings = get_settings()
    setup_logger(settings.log_level, settings.log_file)
    init_db(settings.database_url)


# ──────────────────────────────────────────────────────────
# prospect
# ──────────────────────────────────────────────────────────

@app.command()
def prospect(
    location: str = typer.Argument(..., help="Ciudad, provincia o comunidad autónoma. Ej: 'Madrid', 'Sevilla', 'Andalucía'"),
    limit: int = typer.Option(60, help="Máximo de leads a obtener por ciudad"),
    pages: int = typer.Option(3, help="Páginas de resultados de Google Places (max 3 = 60 resultados)"),
):
    """
    Busca peluquerías en España mediante Google Places API y guarda los leads.
    """
    _bootstrap()
    settings = get_settings()

    if not settings.google_api_configured():
        console.print("[red]ERROR: GOOGLE_PLACES_API_KEY no configurada en .env[/red]")
        raise typer.Exit(1)

    from src.sources.google_places import GooglePlacesSource

    targets = resolve_location(location)
    if not targets:
        console.print(f"[red]No se reconoce la ubicación: {location}[/red]")
        raise typer.Exit(1)

    console.print(f"\n[bold cyan]Buscando en {len(targets)} ciudad(es) para '{location}'[/bold cyan]")

    source = GooglePlacesSource()
    total_new = total_dup = 0

    try:
        with get_session() as session:
            repo = LeadRepository(session)

            for city, province, community in targets:
                console.print(f"\n  >> {city} ({province})")
                raw_leads = source.search(
                    query="peluquería",
                    city=city,
                    province=province,
                    max_pages=pages,
                )

                unique = deduplicate_batch(raw_leads)
                console.print(f"     {len(raw_leads)} encontrados, {len(unique)} únicos en lote")

                for lead in unique:
                    lead.community = community
                    if is_duplicate(lead, repo):
                        total_dup += 1
                        continue
                    repo.create(lead)
                    total_new += 1
    finally:
        source.close()

    console.print(f"\n[bold green]✓ {total_new} nuevos leads guardados, {total_dup} duplicados ignorados.[/bold green]")


# ──────────────────────────────────────────────────────────
# enrich
# ──────────────────────────────────────────────────────────

@app.command()
def enrich(
    limit: int = typer.Option(50, help="Leads a enriquecer"),
    status: str = typer.Option("new", help="Estado de los leads a procesar"),
):
    """
    Enriquece leads: analiza su web, detecta booking platform y busca email.
    """
    _bootstrap()
    settings = get_settings()
    limiter = RateLimiter(delay_ms=settings.request_delay_ms)

    with get_session() as session:
        repo = LeadRepository(session)
        leads = repo.list(status=status, limit=limit)

    if not leads:
        console.print("[yellow]No hay leads con ese estado para enriquecer.[/yellow]")
        return

    console.print(f"\n[bold cyan]Enriqueciendo {len(leads)} leads...[/bold cyan]")
    updated = 0

    with get_session() as session:
        repo = LeadRepository(session)

        for lead in leads:
            limiter.wait()
            updates: dict = {}

            if lead.website:
                result = analyze_website(lead.website)
                updates["booking_platform"] = result.booking_platform
                updates["has_online_booking"] = result.has_online_booking
                updates["uses_whatsapp"] = result.uses_whatsapp

            if not lead.email:
                domain = extract_domain(lead.website) if lead.website else None
                email = find_email(lead.website, domain)
                if email:
                    updates["email"] = email

            if updates:
                updates["status"] = LeadStatus.enriched.value
                repo.update(lead.id, **updates)
                updated += 1
                console.print(f"  ✓ {lead.name[:40]:<40} | {updates.get('booking_platform', '')} | email: {updates.get('email', '–')}")
            else:
                repo.update(lead.id, status=LeadStatus.enriched.value)

    console.print(f"\n[bold green]✓ {updated}/{len(leads)} leads actualizados.[/bold green]")


# ──────────────────────────────────────────────────────────
# score
# ──────────────────────────────────────────────────────────

@app.command()
def score(
    status: Optional[str] = typer.Option(None, help="Filtrar por estado (vacío = todos)"),
    limit: int = typer.Option(500, help="Máximo de leads a puntuar"),
):
    """
    Calcula o recalcula el score comercial de los leads.
    """
    _bootstrap()

    with get_session() as session:
        repo = LeadRepository(session)
        leads = repo.list(status=status, limit=limit)

    if not leads:
        console.print("[yellow]No hay leads para puntuar.[/yellow]")
        return

    console.print(f"\n[bold cyan]Puntuando {len(leads)} leads...[/bold cyan]")

    with get_session() as session:
        repo = LeadRepository(session)
        for lead in leads:
            result = score_lead(lead)
            repo.update(
                lead.id,
                score=result.score,
                score_reasons=json.dumps(result.reasons),
                status=LeadStatus.scored.value,
            )

    console.print(f"[bold green]✓ {len(leads)} leads puntuados.[/bold green]")


# ──────────────────────────────────────────────────────────
# emails generate
# ──────────────────────────────────────────────────────────

@emails_app.command("generate")
def emails_generate(
    min_score: int = typer.Option(50, help="Score mínimo para generar email"),
    limit: int = typer.Option(50, help="Máximo de borradores a generar"),
):
    """
    Genera borradores de email para los leads con score suficiente.
    Solo genera para leads que tengan email y no tengan ya un borrador.
    """
    _bootstrap()

    with get_session() as session:
        repo = LeadRepository(session)
        draft_repo = EmailDraftRepository(session)
        leads = repo.list(
            status=LeadStatus.scored.value,
            min_score=min_score,
            has_email=True,
            limit=limit,
        )

    if not leads:
        console.print(f"[yellow]No hay leads puntuados con score ≥ {min_score} y email disponible.[/yellow]")
        return

    console.print(f"\n[bold cyan]Generando borradores para {len(leads)} leads...[/bold cyan]")
    generated = skipped = 0

    with get_session() as session:
        repo = LeadRepository(session)
        draft_repo = EmailDraftRepository(session)

        for lead in leads:
            existing = draft_repo.get_by_lead(lead.id)
            if existing:
                skipped += 1
                continue

            draft = generate_draft(lead)
            if draft:
                draft_repo.create(draft)
                repo.update(lead.id, status=LeadStatus.email_draft.value)
                generated += 1

    console.print(f"[bold green]✓ {generated} borradores generados ({skipped} ya existían).[/bold green]")
    console.print("[dim]Revísalos con: python main.py emails review[/dim]")


# ──────────────────────────────────────────────────────────
# emails review
# ──────────────────────────────────────────────────────────

@emails_app.command("review")
def emails_review(
    limit: int = typer.Option(20, help="Borradores a mostrar"),
):
    """
    Muestra borradores de email para revisión manual y aprobación.
    """
    _bootstrap()

    with get_session() as session:
        draft_repo = EmailDraftRepository(session)
        lead_repo = LeadRepository(session)
        drafts = draft_repo.list_by_status("draft", limit=limit)

    if not drafts:
        console.print("[yellow]No hay borradores pendientes de revisión.[/yellow]")
        return

    console.print(f"\n[bold]Revisando {len(drafts)} borrador(es)[/bold]\n")

    with get_session() as session:
        draft_repo = EmailDraftRepository(session)
        lead_repo = LeadRepository(session)

        approved = skipped = 0
        for i, draft in enumerate(drafts, 1):
            lead = lead_repo.get_by_id(draft.lead_id)
            if not lead:
                continue

            console.rule(f"[{i}/{len(drafts)}] {lead.name} — Score: {lead.score}")
            console.print(f"[cyan]Para:[/cyan] {lead.email}")
            console.print(f"[cyan]Ciudad:[/cyan] {lead.city} ({lead.province})")
            console.print(f"[cyan]Asunto:[/cyan] {draft.subject}")
            console.print(f"\n{draft.body_text}\n")

            action = typer.prompt(
                "¿Qué hacer? [a]probar / [s]altar / [d]escartar / [q]salir",
                default="s",
            ).strip().lower()

            if action == "a":
                draft_repo.update_status(draft.id, "approved")
                lead_repo.update(lead.id, status=LeadStatus.email_approved.value)
                approved += 1
            elif action == "d":
                draft_repo.update_status(draft.id, "discarded")
                lead_repo.update(lead.id, status=LeadStatus.discarded.value)
            elif action == "q":
                break

    console.print(f"\n[bold green]✓ {approved} aprobados, {skipped} saltados.[/bold green]")


# ──────────────────────────────────────────────────────────
# emails send
# ──────────────────────────────────────────────────────────

@emails_app.command("send")
def emails_send(
    limit: int = typer.Option(50, help="Máximo de emails a enviar"),
    force: bool = typer.Option(False, "--force", help="Confirmar envío real (requiere DRY_RUN=false en .env)"),
):
    """
    Envía los emails aprobados.

    Por defecto opera en DRY-RUN: muestra los emails sin enviarlos.
    Para envío real: establece DRY_RUN=false en .env y usa --force.
    """
    _bootstrap()
    settings = get_settings()

    if settings.dry_run:
        console.print("[bold yellow]MODO DRY-RUN: los emails se mostrarán pero NO se enviarán.[/bold yellow]")
        console.print("[dim]Para enviar emails reales: establece DRY_RUN=false en .env[/dim]\n")
    elif not force:
        console.print("[bold red]ATENCIÓN: Estás a punto de enviar emails reales.[/bold red]")
        typer.confirm("¿Confirmas el envío?", abort=True)

    sender = EmailSender()
    result = sender.send_approved_drafts(limit=limit)

    if settings.dry_run:
        console.print(f"\n[dim]Dry-run completado. {result.get('total', 0)} emails se mostrarían.[/dim]")
    else:
        console.print(f"\n[bold green]✓ Enviados: {result['sent']} | Errores: {result['errors']}[/bold green]")


# ──────────────────────────────────────────────────────────
# export
# ──────────────────────────────────────────────────────────

@app.command()
def export(
    output: str = typer.Option("data/leads_export.csv", help="Ruta del archivo CSV"),
    status: Optional[str] = typer.Option(None, help="Filtrar por estado"),
    min_score: int = typer.Option(0, help="Score mínimo"),
):
    """
    Exporta leads a CSV.
    """
    _bootstrap()

    with get_session() as session:
        repo = LeadRepository(session)
        count = export_to_csv(repo, output, status=status, min_score=min_score)

    console.print(f"[bold green]✓ {count} leads exportados a {output}[/bold green]")


# ──────────────────────────────────────────────────────────
# stats
# ──────────────────────────────────────────────────────────

@app.command()
def stats():
    """
    Muestra estadísticas del sistema.
    """
    _bootstrap()

    with get_session() as session:
        repo = LeadRepository(session)

        table = Table(title="Estado de los Leads", show_header=True, header_style="bold cyan")
        table.add_column("Estado", style="cyan")
        table.add_column("Total", justify="right")

        statuses = [s.value for s in LeadStatus]
        total = 0
        for s in statuses:
            count = repo.count(status=s)
            if count > 0:
                table.add_row(s, str(count))
                total += count

        table.add_section()
        table.add_row("[bold]TOTAL[/bold]", f"[bold]{total}[/bold]")

        console.print(table)

        # Score distribution
        all_leads = repo.list(limit=10_000)
        if all_leads:
            scores = [l.score for l in all_leads if l.score > 0]
            if scores:
                avg = sum(scores) / len(scores)
                high = sum(1 for s in scores if s >= 70)
                mid = sum(1 for s in scores if 40 <= s < 70)
                low = sum(1 for s in scores if s < 40)
                console.print(f"\n[bold]Distribución de scores:[/bold]")
                console.print(f"  Score medio:  {avg:.1f}")
                console.print(f"  Alto (≥70):   {high}")
                console.print(f"  Medio (40-69): {mid}")
                console.print(f"  Bajo (<40):   {low}")

        # Dry-run reminder
        settings = get_settings()
        if settings.dry_run:
            console.print(
                "\n[bold yellow]⚠ DRY_RUN=true — ningún email se enviará hasta que lo cambies en .env[/bold yellow]"
            )


# ──────────────────────────────────────────────────────────
# optout
# ──────────────────────────────────────────────────────────

@app.command()
def optout(
    lead_id: Optional[str] = typer.Option(None, help="ID del lead"),
    email: Optional[str] = typer.Option(None, help="Email del lead"),
):
    """
    Marca un lead como opted-out (no contactar más).
    """
    _bootstrap()

    if not lead_id and not email:
        console.print("[red]Proporciona --lead-id o --email.[/red]")
        raise typer.Exit(1)

    with get_session() as session:
        repo = LeadRepository(session)

        if lead_id:
            repo.mark_opted_out(lead_id)
            console.print(f"[green]✓ Lead {lead_id} marcado como opted-out.[/green]")
        elif email:
            leads = repo.list(limit=1000)
            matched = [l for l in leads if l.email and l.email.lower() == email.lower()]
            if not matched:
                console.print(f"[yellow]No se encontró ningún lead con email {email}.[/yellow]")
                return
            for l in matched:
                repo.mark_opted_out(l.id)
            console.print(f"[green]✓ {len(matched)} lead(s) marcado(s) como opted-out.[/green]")


# ──────────────────────────────────────────────────────────
# pipeline (full run)
# ──────────────────────────────────────────────────────────

@app.command()
def pipeline(
    location: str = typer.Argument(..., help="Ciudad o provincia"),
    min_score: int = typer.Option(50, help="Score mínimo para generar emails"),
    limit: int = typer.Option(60, help="Límite de leads por búsqueda"),
):
    """
    Ejecuta el pipeline completo: buscar → enriquecer → puntuar → generar emails.
    No envía emails — genera borradores para revisión manual.
    """
    console.print(f"\n[bold magenta]Pipeline completo para '{location}'[/bold magenta]")

    # Step 1: prospect
    prospect(location=location, limit=limit, pages=3)

    # Step 2: enrich
    enrich(limit=limit * 2, status="new")

    # Step 3: score
    score(status="enriched", limit=limit * 2)

    # Step 4: generate email drafts
    emails_generate(min_score=min_score, limit=limit)

    console.print(
        f"\n[bold green]Pipeline completado.[/bold green]\n"
        f"Revisa los borradores con: [cyan]python main.py emails review[/cyan]\n"
        f"Exporta a CSV con: [cyan]python main.py export[/cyan]"
    )


if __name__ == "__main__":
    app()
