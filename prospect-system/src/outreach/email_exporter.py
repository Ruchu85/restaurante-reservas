"""
Exporta los borradores de email como una página HTML para revisión manual.

Agrupada por provincia igual que el export de WhatsApp: se lee cada borrador
completo (asunto + cuerpo) y se marca aprobar/descartar con checkboxes. El
estado se guarda en localStorage; "Copiar IDs aprobados" / "Copiar IDs
descartados" da los IDs para sincronizar la base de datos con
`emails approve --ids …` / `emails discard --ids …`.
"""
from __future__ import annotations

import html
import unicodedata
from datetime import datetime
from pathlib import Path

from loguru import logger


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return "-".join(ascii_only.lower().split()) or "sin-provincia"


def export_email_review_html(
    drafts_with_leads: list[dict],
    output_path: str,
    *,
    title: str = "Reservas — Revisión de emails",
) -> int:
    grouped: dict[str, list[dict]] = {}
    for item in drafts_with_leads:
        province = (item["lead"].province or "").strip() or "Sin provincia"
        grouped.setdefault(province, []).append(item)

    by_province: dict[str, list[dict]] = {
        province: sorted(
            grouped[province],
            key=lambda i: (-(i["lead"].score or 0), (i["lead"].name or "")),
        )
        for province in sorted(grouped)
    }

    total = len(drafts_with_leads)
    generated = datetime.now().strftime("%d/%m/%Y %H:%M")

    parts: list[str] = [_head(title, total)]

    parts.append('<div class="topnav">')
    for province, items in by_province.items():
        parts.append(
            f'<a href="#{slugify(province)}">{html.escape(province)} '
            f'<b>{len(items)}</b></a>'
        )
    parts.append(f'<span class="total">{total} borradores · {generated}</span>')
    parts.append("</div>")

    parts.append('<div class="wrap">')
    parts.append(f"<h1>✉️ {html.escape(title)}</h1>")
    parts.append(
        f'<p class="subtitle">Generado el {generated} · {total} borradores en '
        f"{len(by_province)} provincia(s).</p>"
    )
    parts.append(_tips_box())
    parts.append(_toolbar())

    parts.append('<div class="summary">')
    for province, items in by_province.items():
        parts.append(
            f'<a class="scard" href="#{slugify(province)}">'
            f'<div class="n">{len(items)}</div>'
            f'<div class="l">{html.escape(province)}</div></a>'
        )
    parts.append(f'<div class="scard total-card"><div class="n">{total}</div><div class="l">Total</div></div>')
    parts.append("</div>")

    for province, items in by_province.items():
        slug = slugify(province)
        parts.append(f'<section class="prov-section" id="{slug}">')
        parts.append(
            f'<div class="prov-header">'
            f"<h2>📍 {html.escape(province)}</h2>"
            f'<span class="badge">{len(items)} borradores</span>'
            f'<span class="decided-badge" data-province-counter="{slug}">0 decididos</span>'
            f"</div>"
        )

        for index, item in enumerate(items, 1):
            draft, lead = item["draft"], item["lead"]
            body_html = html.escape(draft.body_text or "").replace("\n", "<br>")
            parts.append(
                f'<article class="card" data-id="{html.escape(draft.id)}" data-province="{slug}">'
            )
            parts.append(
                f'<div class="card-head">'
                f'<span class="num">#{index}</span>'
                f'<span class="name">{html.escape(lead.name or "—")}</span>'
                f'<span class="score">Score {lead.score if lead.score is not None else "—"}</span>'
                f'<span class="city">{html.escape(lead.city or "—")}</span>'
                f'<span class="email">{html.escape(lead.email or "—")}</span>'
                f"</div>"
            )
            parts.append(
                f'<div class="subject"><b>Asunto:</b> {html.escape(draft.subject or "")}</div>'
            )
            parts.append(f'<div class="body">{body_html}</div>')
            parts.append(
                '<div class="card-actions">'
                '<button type="button" class="btn-approve">✓ Aprobar</button>'
                '<button type="button" class="btn-discard">✕ Descartar</button>'
                '<span class="decision"></span>'
                "</div>"
            )
            parts.append("</article>")

        parts.append("</section>")

    parts.append("</div>")  # .wrap
    parts.append(_script())
    parts.append("</body></html>")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(parts), encoding="utf-8")

    logger.success(f"[Email] HTML exportado → {output}")
    for province, items in by_province.items():
        logger.info(f"   {province:<28} {len(items):>3} borradores")

    return total


def _head(title: str, count: int) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} ({count})</title>
<style>
  *{{box-sizing:border-box;}}
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        background:#f0f2f5;margin:0;padding:0;color:#1a1a1a;}}
  .topnav{{position:sticky;top:0;z-index:100;background:#7c3aed;
           padding:.6rem 1rem;display:flex;gap:.5rem;flex-wrap:wrap;
           box-shadow:0 2px 8px rgba(0,0,0,.2);}}
  .topnav a{{color:#fff;text-decoration:none;font-size:.8rem;font-weight:600;
             background:rgba(255,255,255,.15);padding:.35rem .75rem;
             border-radius:999px;white-space:nowrap;}}
  .topnav a:hover{{background:rgba(255,255,255,.32);}}
  .topnav b{{opacity:.75;font-weight:700;}}
  .topnav .total{{margin-left:auto;color:rgba(255,255,255,.85);
                  font-size:.8rem;align-self:center;white-space:nowrap;}}
  .wrap{{max-width:900px;margin:0 auto;padding:1.5rem 1rem 4rem;}}
  h1{{color:#7c3aed;margin:0 0 .2rem;font-size:1.4rem;}}
  .subtitle{{color:#555;font-size:.85rem;margin:0 0 1.2rem;}}
  .tip{{background:#fffde7;border-left:4px solid #f9a825;border-radius:0 8px 8px 0;
        padding:.7rem 1rem;margin-bottom:1rem;font-size:.85rem;color:#555;}}
  .tip b{{color:#333;}}
  .toolbar{{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;
            background:#fff;border-radius:10px;padding:.7rem 1rem;
            margin-bottom:1.2rem;box-shadow:0 2px 6px rgba(0,0,0,.06);}}
  .toolbar button{{border:1px solid #d6d9de;background:#fff;border-radius:8px;
                   padding:.4rem .8rem;font-size:.8rem;font-weight:600;
                   cursor:pointer;color:#333;}}
  .toolbar button:hover{{background:#f5f6f8;}}
  .toolbar .progress{{margin-left:auto;font-size:.82rem;color:#555;font-weight:600;}}
  .summary{{display:flex;gap:.8rem;flex-wrap:wrap;margin-bottom:1.5rem;}}
  .scard{{background:#fff;border-radius:10px;padding:.8rem 1rem;text-decoration:none;
          box-shadow:0 2px 6px rgba(0,0,0,.07);text-align:center;
          flex:1;min-width:110px;color:inherit;}}
  .scard:hover{{box-shadow:0 3px 12px rgba(0,0,0,.12);}}
  .scard .n{{font-size:1.7rem;font-weight:800;color:#7c3aed;line-height:1;}}
  .scard .l{{font-size:.74rem;color:#777;margin-top:.25rem;}}
  .total-card{{background:#7c3aed;}}
  .total-card .n,.total-card .l{{color:#fff;}}
  .prov-section{{margin-bottom:2.2rem;scroll-margin-top:56px;}}
  .prov-header{{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
                background:#7c3aed;color:#fff;border-radius:12px;
                padding:.75rem 1.2rem;margin-bottom:.8rem;}}
  .prov-header h2{{font-size:1.05rem;margin:0;}}
  .prov-header .badge{{background:rgba(255,255,255,.2);border-radius:999px;
                       padding:.2rem .7rem;font-size:.78rem;font-weight:700;}}
  .prov-header .decided-badge{{background:#25d366;border-radius:999px;
                            padding:.2rem .7rem;font-size:.78rem;font-weight:700;
                            margin-left:auto;}}
  .card{{background:#fff;border-radius:12px;padding:1rem 1.2rem;margin-bottom:.9rem;
         box-shadow:0 2px 8px rgba(0,0,0,.07);scroll-margin-top:56px;}}
  .card.is-approved{{box-shadow:0 0 0 2px #25d366 inset;}}
  .card.is-discarded{{opacity:.4;}}
  .card-head{{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;
              font-size:.82rem;margin-bottom:.5rem;}}
  .card-head .num{{color:#999;}}
  .card-head .name{{font-weight:700;}}
  .card-head .score{{background:#f0edff;color:#7c3aed;border-radius:999px;
                     padding:.1rem .6rem;font-weight:700;}}
  .card-head .city{{color:#666;}}
  .card-head .email{{color:#666;margin-left:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}}
  .subject{{font-size:.88rem;margin-bottom:.5rem;color:#333;}}
  .body{{font-size:.85rem;line-height:1.55;color:#333;white-space:normal;
         max-height:230px;overflow-y:auto;background:#fafafa;border-radius:8px;
         padding:.7rem .9rem;margin-bottom:.6rem;}}
  .card-actions{{display:flex;gap:.5rem;align-items:center;}}
  .card-actions button{{border:1px solid #d6d9de;border-radius:8px;padding:.35rem .8rem;
                        font-size:.8rem;font-weight:700;cursor:pointer;background:#fff;}}
  .btn-approve{{color:#128c00;}}
  .btn-approve:hover{{background:#eafbea;}}
  .btn-discard{{color:#c0392b;}}
  .btn-discard:hover{{background:#fdecea;}}
  .decision{{font-size:.8rem;font-weight:700;}}
</style>
</head>
<body>"""


def _tips_box() -> str:
    return """<div class="tip">
  <b>Cómo usarlo:</b> lee cada borrador y pulsa <b>Aprobar</b> o <b>Descartar</b>.
  Las decisiones se guardan en este navegador. Al terminar, pulsa
  <b>"Copiar IDs aprobados"</b> y <b>"Copiar IDs descartados"</b> y pégalos en
  <code>emails approve --ids …</code> / <code>emails discard --ids …</code>
  para sincronizar la base de datos.
</div>"""


def _toolbar() -> str:
    return """<div class="toolbar">
  <button type="button" id="copy-approved">📋 Copiar IDs aprobados</button>
  <button type="button" id="copy-discarded">📋 Copiar IDs descartados</button>
  <button type="button" id="reset-decisions">↺ Reiniciar decisiones</button>
  <span class="progress" id="progress">0 / 0 decididos</span>
</div>"""


def _script() -> str:
    return """<script>
(function () {
  var KEY = 'email-decisions';
  var stored = JSON.parse(localStorage.getItem(KEY) || '{}'); // id -> 'approved'|'discarded'
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card[data-id]'));

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(stored));
  }

  function render() {
    var counts = {};
    var decided = 0;
    cards.forEach(function (card) {
      var id = card.dataset.id;
      var state = stored[id];
      card.classList.toggle('is-approved', state === 'approved');
      card.classList.toggle('is-discarded', state === 'discarded');
      var label = card.querySelector('.decision');
      label.textContent = state ? (state === 'approved' ? '✓ Aprobado' : '✕ Descartado') : '';
      label.style.color = state === 'approved' ? '#128c00' : (state === 'discarded' ? '#c0392b' : '');
      if (state) {
        decided++;
        var p = card.dataset.province;
        counts[p] = (counts[p] || 0) + 1;
      }
    });
    document.querySelectorAll('[data-province-counter]').forEach(function (el) {
      el.textContent = (counts[el.dataset.provinceCounter] || 0) + ' decididos';
    });
    document.getElementById('progress').textContent = decided + ' / ' + cards.length + ' decididos';
  }

  cards.forEach(function (card) {
    card.querySelector('.btn-approve').addEventListener('click', function () {
      stored[card.dataset.id] = stored[card.dataset.id] === 'approved' ? null : 'approved';
      if (!stored[card.dataset.id]) delete stored[card.dataset.id];
      persist();
      render();
    });
    card.querySelector('.btn-discard').addEventListener('click', function () {
      stored[card.dataset.id] = stored[card.dataset.id] === 'discarded' ? null : 'discarded';
      if (!stored[card.dataset.id]) delete stored[card.dataset.id];
      persist();
      render();
    });
  });

  function copyByState(state, btnId) {
    document.getElementById(btnId).addEventListener('click', function () {
      var ids = Object.keys(stored).filter(function (id) { return stored[id] === state; }).join(',');
      if (!ids) { alert('Todavía no hay ningún email ' + (state === 'approved' ? 'aprobado' : 'descartado') + '.'); return; }
      navigator.clipboard.writeText(ids).then(function () {
        alert('IDs copiados (' + (state === 'approved' ? 'aprobados' : 'descartados') + ').');
      }, function () {
        window.prompt('Copia estos IDs:', ids);
      });
    });
  }
  copyByState('approved', 'copy-approved');
  copyByState('discarded', 'copy-discarded');

  document.getElementById('reset-decisions').addEventListener('click', function () {
    if (!confirm('¿Borrar todas las decisiones de este navegador?')) return;
    stored = {};
    persist();
    render();
  });

  render();
})();
</script>"""
