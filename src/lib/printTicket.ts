import type { Appointment } from "@/types";

export interface SalonInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}-${d.getMonth() + 1}-${String(d.getFullYear()).slice(2)}`;
}

export function printTickets(appointments: Appointment[], salon?: SalonInfo) {
  const salonName = salon?.name ?? "Salón";
  const salonAddress = salon?.address ?? "";
  const salonPhone = salon?.phone ?? "";

  const tickets = appointments
    .map((appt, idx) => {
      const num = appt.ticket_number ?? (200 + idx + 1);
      const dateStr = fmtDateShort(appt.starts_at);
      const timeStr = `${fmtTime(appt.starts_at)} – ${fmtTime(appt.ends_at)}`;

      return `
<div class="ticket">
  <div class="header-row">
    <div class="stamp">
      <div class="stamp-name">${salonName}</div>
      ${salonAddress ? `<div class="stamp-line">${salonAddress}</div>` : ""}
      ${salonPhone ? `<div class="stamp-line">Telf.: ${salonPhone}</div>` : ""}
    </div>
    <div class="num-block">
      <span class="num-label">Nº.</span>
      <span class="num-val">${num}</span>
    </div>
  </div>

  <div class="date-row">
    <span>de&nbsp;&nbsp;<u>&nbsp;${dateStr}&nbsp;</u>&nbsp;&nbsp;de</span>
  </div>

  <div class="client-row">
    <span class="client-label">D.</span>
    <span class="client-val">${appt.customer_name}</span>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="col-qty">Cantidad</th>
        <th class="col-concept">C O N C E P T O</th>
        <th class="col-price">Precio</th>
        <th class="col-total">T O T A L</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-qty">1</td>
        <td class="col-concept">${appt.service}${appt.notes ? ` – ${appt.notes}` : ""}</td>
        <td class="col-price"></td>
        <td class="col-total"></td>
      </tr>
      <tr><td></td><td>${timeStr}</td><td></td><td></td></tr>
      <tr class="empty-row"><td></td><td></td><td></td><td></td></tr>
      <tr class="empty-row"><td></td><td></td><td></td><td></td></tr>
      <tr class="empty-row"><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>
</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Tickets</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; background: #fff; }

  .ticket {
    width: 148mm;
    padding: 6mm 8mm;
    border-bottom: 3px dashed #999;
    page-break-inside: avoid;
    margin-bottom: 4mm;
  }
  .ticket:last-child { border-bottom: none; }

  /* Header: stamp box + ticket number */
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 3mm;
  }
  .stamp {
    border: 2px solid #2255aa;
    padding: 3mm 4mm;
    min-width: 60mm;
  }
  .stamp-name { font-size: 14px; font-weight: bold; text-align: center; }
  .stamp-line { font-size: 10px; text-align: center; color: #333; margin-top: 1mm; }

  .num-block { text-align: right; padding-top: 2mm; }
  .num-label { font-size: 12px; }
  .num-val { font-size: 22px; font-weight: bold; margin-left: 2mm; border-bottom: 2px solid #000; padding-bottom: 1mm; }

  /* Date and client lines */
  .date-row { margin: 3mm 0 2mm; font-size: 12px; }
  .client-row { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 3mm; font-size: 12px; }
  .client-label { font-size: 14px; font-weight: bold; }
  .client-val { border-bottom: 1px solid #000; flex: 1; min-height: 5mm; }

  /* Items table */
  .items { width: 100%; border-collapse: collapse; font-size: 11px; }
  .items th, .items td {
    border: 1px solid #555;
    padding: 1.5mm 2mm;
    text-align: left;
    vertical-align: top;
  }
  .items thead th {
    text-align: center;
    font-size: 10px;
    letter-spacing: 1px;
    background: #f8f8f8;
  }
  .col-qty   { width: 14mm; text-align: center !important; }
  .col-price { width: 20mm; }
  .col-total { width: 22mm; }
  .col-concept { }
  .empty-row td { height: 7mm; }

  @media print {
    @page { size: A5 landscape; margin: 8mm; }
    body { width: auto; }
  }
</style>
</head>
<body>
${tickets}
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=700,height=500");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
