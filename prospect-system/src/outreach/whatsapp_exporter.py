"""
Exporta los mensajes de WhatsApp como una página HTML con botones clicables.

La página se agrupa por provincia, con navegación superior fija, para poder
trabajar provincia a provincia sin perderse. Cada fila abre WhatsApp (web o
móvil) con el mensaje ya escrito: solo hay que pulsar Enviar.

El estado "enviado" se guarda en el localStorage del navegador, y el botón
"Copiar IDs enviados" permite volcarlos a `whatsapp mark-sent` para que la base
de datos quede sincronizada.
"""
from __future__ import annotations

import csv
import html
import json
import unicodedata
from datetime import datetime
from pathlib import Path

from loguru import logger


def slugify(value: str) -> str:
    """'A Coruña' → 'a-coruna'. Sirve como ancla HTML estable."""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return "-".join(ascii_only.lower().split()) or "sin-provincia"


def _format_phone(phone: str | None) -> str:
    if not phone:
        return "—"
    digits = phone.replace("+34", "").strip()
    if len(digits) == 9:
        return f"{digits[:3]} {digits[3:5]} {digits[5:7]} {digits[7:]}"
    return phone


def export_whatsapp_html(
    drafts_with_leads: list[dict],
    output_path: str,
    *,
    title: str = "Reservas — Outreach WhatsApp",
) -> int:
    """
    Renderiza el HTML agrupado por provincia. Devuelve el número de leads.
    """
    grouped: dict[str, list[dict]] = {}
    for item in drafts_with_leads:
        province = (item["lead"].province or "").strip() or "Sin provincia"
        grouped.setdefault(province, []).append(item)

    # Provincias en orden alfabético; dentro de cada una, por ciudad y nombre.
    by_province: dict[str, list[dict]] = {
        province: sorted(
            grouped[province],
            key=lambda i: ((i["lead"].city or ""), (i["lead"].name or "")),
        )
        for province in sorted(grouped)
    }

    total = len(drafts_with_leads)
    already_sent = sum(
        1 for item in drafts_with_leads if item["draft"].whatsapp_status == "sent"
    )
    generated = datetime.now().strftime("%d/%m/%Y %H:%M")

    parts: list[str] = [_head(title, total)]

    # ── Navegación fija por provincia ──────────────────────────────────
    parts.append('<div class="topnav">')
    for province, items in by_province.items():
        parts.append(
            f'<a href="#{slugify(province)}">{html.escape(province)} '
            f'<b>{len(items)}</b></a>'
        )
    parts.append(f'<span class="total">{total} mensajes · {generated}</span>')
    parts.append("</div>")

    parts.append('<div class="wrap">')
    parts.append(f"<h1>📱 {html.escape(title)}</h1>")
    parts.append(
        f'<p class="subtitle">Generado el {generated} · {total} mensajes en '
        f"{len(by_province)} provincia(s) · {already_sent} ya marcados como enviados.</p>"
    )
    parts.append(_tips_box())
    parts.append(_toolbar())

    # ── Tarjetas resumen ───────────────────────────────────────────────
    parts.append('<div class="summary">')
    for province, items in by_province.items():
        parts.append(
            f'<a class="scard" href="#{slugify(province)}">'
            f'<div class="n">{len(items)}</div>'
            f'<div class="l">{html.escape(province)}</div></a>'
        )
    parts.append(f'<div class="scard total-card"><div class="n">{total}</div><div class="l">Total</div></div>')
    parts.append("</div>")

    # ── Secciones por provincia ────────────────────────────────────────
    for province, items in by_province.items():
        slug = slugify(province)
        parts.append(f'<section class="prov-section" id="{slug}">')
        parts.append(
            f'<div class="prov-header">'
            f"<h2>📍 {html.escape(province)}</h2>"
            f'<span class="badge">{len(items)} mensajes</span>'
            f'<span class="sent-badge" data-province-counter="{slug}">0 enviados</span>'
            f"</div>"
        )
        parts.append(
            '<div class="table-scroll"><table><thead><tr>'
            "<th>#</th><th>Restaurante</th><th>Ciudad</th><th>Teléfono</th>"
            "<th>Acción</th><th>Enviado</th>"
            "</tr></thead><tbody>"
        )

        for index, item in enumerate(items, 1):
            draft, lead = item["draft"], item["lead"]
            is_sent = draft.whatsapp_status == "sent"
            parts.append(
                f'<tr data-id="{html.escape(draft.id)}" data-province="{slug}"'
                f'{" class=\"is-sent\"" if is_sent else ""}>'
                f'<td class="num">{index}</td>'
                f'<td class="name">{html.escape(lead.name or "—")}</td>'
                f'<td class="city">{html.escape(lead.city or "—")}</td>'
                f'<td class="phone">{html.escape(_format_phone(draft.phone))}</td>'
                f'<td><a class="btn-wa" href="{html.escape(draft.wa_link or "")}" '
                f'target="_blank" rel="noopener">💬 Abrir en WhatsApp</a></td>'
                f'<td><input type="checkbox" class="sent-check" '
                f'aria-label="Marcar como enviado"{" checked" if is_sent else ""}></td>'
                "</tr>"
            )

        parts.append("</tbody></table></div>")
        parts.append("</section>")

    parts.append("</div>")  # .wrap
    parts.append(_script())
    parts.append("</body></html>")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(parts), encoding="utf-8")

    logger.success(f"[WhatsApp] HTML exportado → {output}")
    for province, items in by_province.items():
        logger.info(f"   {province:<28} {len(items):>3} mensajes")

    return total


def export_whatsapp_csv(drafts_with_leads: list[dict], output_path: str) -> int:
    """Exporta los enlaces wa.me como CSV para usarlos en otra herramienta."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(
            ["id", "nombre", "telefono", "ciudad", "provincia", "estado", "wa_link", "mensaje"]
        )
        for item in drafts_with_leads:
            draft, lead = item["draft"], item["lead"]
            writer.writerow(
                [
                    draft.id,
                    lead.name or "",
                    draft.phone or "",
                    lead.city or "",
                    lead.province or "",
                    draft.whatsapp_status,
                    draft.wa_link or "",
                    (draft.message_text or "").replace("\n", " "),
                ]
            )

    logger.success(f"[WhatsApp] CSV exportado → {output}")
    return len(drafts_with_leads)


# ──────────────────────────────────────────────────────────────────────
# Plantillas HTML
# ──────────────────────────────────────────────────────────────────────

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
  .topnav{{position:sticky;top:0;z-index:100;background:#128c7e;
           padding:.6rem 1rem;display:flex;gap:.5rem;flex-wrap:wrap;
           box-shadow:0 2px 8px rgba(0,0,0,.2);}}
  .topnav a{{color:#fff;text-decoration:none;font-size:.8rem;font-weight:600;
             background:rgba(255,255,255,.15);padding:.35rem .75rem;
             border-radius:999px;white-space:nowrap;}}
  .topnav a:hover{{background:rgba(255,255,255,.32);}}
  .topnav b{{opacity:.75;font-weight:700;}}
  .topnav .total{{margin-left:auto;color:rgba(255,255,255,.85);
                  font-size:.8rem;align-self:center;white-space:nowrap;}}
  .wrap{{max-width:1100px;margin:0 auto;padding:1.5rem 1rem 4rem;}}
  h1{{color:#128c7e;margin:0 0 .2rem;font-size:1.4rem;}}
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
  .scard .n{{font-size:1.7rem;font-weight:800;color:#128c7e;line-height:1;}}
  .scard .l{{font-size:.74rem;color:#777;margin-top:.25rem;}}
  .total-card{{background:#128c7e;}}
  .total-card .n,.total-card .l{{color:#fff;}}
  .prov-section{{margin-bottom:2.2rem;scroll-margin-top:56px;}}
  .prov-header{{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
                background:#128c7e;color:#fff;border-radius:12px 12px 0 0;
                padding:.75rem 1.2rem;}}
  .prov-header h2{{font-size:1.05rem;margin:0;}}
  .prov-header .badge{{background:rgba(255,255,255,.2);border-radius:999px;
                       padding:.2rem .7rem;font-size:.78rem;font-weight:700;}}
  .prov-header .sent-badge{{background:#25d366;border-radius:999px;
                            padding:.2rem .7rem;font-size:.78rem;font-weight:700;
                            margin-left:auto;}}
  .table-scroll{{overflow-x:auto;}}
  table{{border-collapse:collapse;width:100%;background:#fff;
         border-radius:0 0 12px 12px;overflow:hidden;
         box-shadow:0 2px 8px rgba(0,0,0,.08);}}
  th{{background:#f8f9fa;color:#444;padding:.6rem 1rem;text-align:left;
      font-size:.78rem;border-bottom:2px solid #e9ecef;white-space:nowrap;}}
  td{{padding:.55rem 1rem;border-bottom:1px solid #f0f0f0;
      vertical-align:middle;font-size:.85rem;}}
  tr:last-child td{{border-bottom:none;}}
  tr:hover td{{background:#fafcff;}}
  tr.is-sent{{opacity:.45;}}
  .num{{color:#888;font-size:.78rem;}}
  .name{{font-weight:600;}}
  .city{{color:#666;font-size:.8rem;}}
  .phone{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85rem;white-space:nowrap;}}
  .btn-wa{{display:inline-block;padding:.4rem .9rem;border-radius:20px;
           font-size:.8rem;text-decoration:none;font-weight:700;
           background:#25d366;color:#fff;white-space:nowrap;}}
  .btn-wa:hover{{background:#1ebe5d;}}
  .sent-check{{width:18px;height:18px;accent-color:#128c7e;cursor:pointer;}}
</style>
</head>
<body>"""


def _tips_box() -> str:
    return """<div class="tip">
  <b>Cómo usarlo:</b> ve provincia a provincia. Pulsa 💬 en cada fila, envía el
  mensaje y marca la casilla <b>Enviado</b>. El progreso se guarda en este
  navegador. Ritmo recomendado: <b>20–30 mensajes por sesión</b> para que
  WhatsApp no limite la cuenta. Mejor franja para restaurantes:
  <b>martes a jueves, 10:00–12:00</b> (fuera del servicio).
</div>"""


def _toolbar() -> str:
    return """<div class="toolbar">
  <button type="button" id="copy-sent">📋 Copiar IDs enviados</button>
  <button type="button" id="reset-sent">↺ Reiniciar marcas</button>
  <span class="progress" id="progress">0 / 0 enviados</span>
</div>"""


def _script() -> str:
    # Sin dependencias externas: el HTML tiene que funcionar abriéndolo a pelo.
    return """<script>
(function () {
  var KEY = 'wa-sent-ids';
  var stored = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr[data-id]'));

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(Array.from(stored)));
  }

  function render() {
    var counts = {};
    rows.forEach(function (row) {
      var sent = stored.has(row.dataset.id);
      row.classList.toggle('is-sent', sent);
      row.querySelector('.sent-check').checked = sent;
      var p = row.dataset.province;
      counts[p] = (counts[p] || 0) + (sent ? 1 : 0);
    });
    document.querySelectorAll('[data-province-counter]').forEach(function (el) {
      el.textContent = (counts[el.dataset.provinceCounter] || 0) + ' enviados';
    });
    document.getElementById('progress').textContent =
      stored.size + ' / ' + rows.length + ' enviados';
  }

  rows.forEach(function (row) {
    // Marcar automáticamente al abrir WhatsApp: es el gesto que ya hace el usuario.
    row.querySelector('.btn-wa').addEventListener('click', function () {
      stored.add(row.dataset.id);
      persist();
      render();
    });
    row.querySelector('.sent-check').addEventListener('change', function (e) {
      if (e.target.checked) stored.add(row.dataset.id);
      else stored.delete(row.dataset.id);
      persist();
      render();
    });
  });

  document.getElementById('copy-sent').addEventListener('click', function () {
    var ids = Array.from(stored).join(',');
    if (!ids) { alert('Todavía no has marcado ningún mensaje como enviado.'); return; }
    navigator.clipboard.writeText(ids).then(function () {
      alert('IDs copiados. Sincroniza la base de datos con:\\n\\n' +
            'run.bat whatsapp mark-sent --ids "' + (ids.length > 60 ? '<pegar aquí>' : ids) + '"');
    }, function () {
      window.prompt('Copia estos IDs:', ids);
    });
  });

  document.getElementById('reset-sent').addEventListener('click', function () {
    if (!confirm('¿Borrar todas las marcas de enviado de este navegador?')) return;
    stored = new Set();
    persist();
    render();
  });

  render();
})();
</script>"""
