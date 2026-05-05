import type { Appointment } from "@/types";

export interface SalonInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const TICKET_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; }
  .ticket {
    width: 130mm;
    min-height: 190mm;
    padding: 8mm 8mm 6mm;
    font-family: 'Arial', sans-serif;
    font-size: 11px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  /* ── Header ── */
  .header {
    text-align: center;
    padding-bottom: 4mm;
    border-bottom: 2px solid #111;
    margin-bottom: 4mm;
  }
  .header-name {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .header-sub {
    font-size: 9px;
    color: #555;
    margin-top: 1mm;
    letter-spacing: 0.5px;
  }
  /* ── Ticket meta row ── */
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4mm;
  }
  .ticket-num-label { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .ticket-num-val   { font-size: 26px; font-weight: 900; color: #111; line-height: 1; }
  .ticket-date-label { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
  .ticket-date-val   { font-size: 12px; font-weight: 700; text-align: right; }
  /* ── Divider ── */
  .divider {
    border: none;
    border-top: 1px dashed #bbb;
    margin: 3mm 0;
  }
  /* ── Client ── */
  .client-row {
    display: flex;
    gap: 2mm;
    align-items: baseline;
    margin-bottom: 4mm;
  }
  .client-label { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
  .client-val   { font-size: 13px; font-weight: 700; flex: 1; border-bottom: 1px solid #bbb; padding-bottom: 0.5mm; }
  /* ── Items table ── */
  .items {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-bottom: 3mm;
  }
  .items thead tr {
    border-bottom: 1.5px solid #111;
  }
  .items th {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #666;
    padding: 1mm 1.5mm 1.5mm;
    text-align: left;
  }
  .items td {
    padding: 2mm 1.5mm;
    vertical-align: top;
    border-bottom: 1px solid #eee;
  }
  .items .col-concept { width: auto; }
  .items .col-time    { width: 22mm; color: #666; font-size: 9px; }
  .items .col-price   { width: 18mm; text-align: right; }
  /* ── Total ── */
  .total-section {
    border-top: 2px solid #111;
    padding-top: 2.5mm;
    margin-top: 1mm;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .total-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  .total-val   { font-size: 20px; font-weight: 900; color: #111; }
  /* ── Footer ── */
  .footer {
    margin-top: auto;
    padding-top: 5mm;
    text-align: center;
    font-size: 9px;
    color: #888;
    border-top: 1px dashed #bbb;
    letter-spacing: 0.5px;
  }
`;

function buildTicketHtml(
  appt: Appointment,
  idx: number,
  salonName: string,
  salonAddress: string,
  salonPhone: string,
) {
  const num = String(appt.ticket_number ?? 200 + idx + 1).padStart(4, "0");
  const dateStr = fmtDate(appt.starts_at);
  const timeStr = `${fmtTime(appt.starts_at)} – ${fmtTime(appt.ends_at)}`;
  const price = appt.price;
  const priceStr = price != null ? `${price.toFixed(2)} €` : "—";

  const contactLine = [salonAddress, salonPhone ? `Tel. ${salonPhone}` : ""]
    .filter(Boolean)
    .join("  ·  ");

  return `
<div class="ticket">
  <div class="header">
    <div class="header-name">${salonName}</div>
    ${contactLine ? `<div class="header-sub">${contactLine}</div>` : ""}
  </div>

  <div class="meta-row">
    <div>
      <div class="ticket-num-label">Ticket nº</div>
      <div class="ticket-num-val">#${num}</div>
    </div>
    <div>
      <div class="ticket-date-label">Fecha</div>
      <div class="ticket-date-val">${dateStr}</div>
    </div>
  </div>

  <div class="client-row">
    <span class="client-label">Cliente</span>
    <span class="client-val">${appt.customer_name}</span>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="col-concept">Concepto</th>
        <th class="col-time">Horario</th>
        <th class="col-price">Importe</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-concept">${appt.service}${appt.notes ? `<br><span style="color:#777;font-size:9px">${appt.notes}</span>` : ""}</td>
        <td class="col-time">${timeStr}</td>
        <td class="col-price">${priceStr}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <span class="total-label">Total</span>
      <span class="total-val">${priceStr}</span>
    </div>
  </div>

  <div class="footer">
    ¡Gracias por su visita!<br>Hasta pronto
  </div>
</div>`;
}

export async function downloadTicketsPDF(appointments: Appointment[], salon?: SalonInfo) {
  if (!appointments.length) return;

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const salonName = salon?.name ?? "Salón";
  const salonAddress = salon?.address ?? "";
  const salonPhone = salon?.phone ?? "";

  // A5 portrait: 148 × 210 mm
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });

  for (let i = 0; i < appointments.length; i++) {
    const ticketHtml = buildTicketHtml(
      appointments[i],
      i,
      salonName,
      salonAddress,
      salonPhone,
    );

    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:fixed;left:-9999px;top:0;background:white;width:130mm;";
    wrapper.innerHTML = `<style>${TICKET_STYLES}</style>${ticketHtml}`;
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      if (i > 0) doc.addPage([148, 210], "portrait");

      const imgData = canvas.toDataURL("image/png");
      const pdfW = 148;
      const imgH = (canvas.height / canvas.width) * pdfW;
      doc.addImage(imgData, "PNG", 0, 0, pdfW, Math.min(imgH, 210));
    } finally {
      document.body.removeChild(wrapper);
    }
  }

  const dateStr = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  doc.save(`tickets-${dateStr}.pdf`);
}

export const printTickets = downloadTicketsPDF;
