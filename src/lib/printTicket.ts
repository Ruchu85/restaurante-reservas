import type { Appointment } from "@/types";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function printTickets(appointments: Appointment[], salonName = "Salón") {
  const tickets = appointments
    .map(
      (appt) => `
    <div class="ticket">
      <div class="salon">${salonName}</div>
      <div class="divider"></div>
      <div class="row"><span class="lbl">Cliente</span><span class="val">${appt.customer_name}</span></div>
      <div class="row"><span class="lbl">Servicio</span><span class="val">${appt.service}</span></div>
      <div class="row"><span class="lbl">Fecha</span><span class="val">${fmtDate(appt.starts_at)}</span></div>
      <div class="row"><span class="lbl">Hora</span><span class="val">${fmtTime(appt.starts_at)} – ${fmtTime(appt.ends_at)}</span></div>
      ${appt.notes ? `<div class="divider"></div><div class="notes">${appt.notes}</div>` : ""}
      <div class="divider"></div>
      <div class="footer">¡Gracias por su visita!</div>
    </div>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Tickets</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Courier New',monospace;font-size:12px;background:#fff}
  .ticket{width:80mm;padding:8mm;border-bottom:2px dashed #ccc;page-break-inside:avoid}
  .ticket:last-child{border-bottom:none}
  .salon{font-size:16px;font-weight:bold;text-align:center;margin-bottom:4mm}
  .divider{border-top:1px dashed #999;margin:3mm 0}
  .row{display:flex;justify-content:space-between;margin-bottom:1.5mm}
  .lbl{color:#666}
  .val{font-weight:bold;text-align:right;max-width:52mm;word-break:break-word}
  .notes{font-size:11px;color:#555;margin-bottom:2mm}
  .footer{text-align:center;color:#999;font-size:10px}
  @media print{@page{size:80mm auto;margin:0}body{width:80mm}}
</style>
</head>
<body>
${tickets}
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=450,height=650");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
