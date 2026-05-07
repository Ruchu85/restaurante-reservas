import type { Appointment } from "@/types";

export interface SalonInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  owner?: string | null;
  nif?: string | null;
  city?: string | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

function formatTicketNum(ticketNumber: number | null, fallbackIdx: number): string {
  if (!ticketNumber) {
    const now = new Date();
    const yyyymm = now.getFullYear() * 100 + (now.getMonth() + 1);
    return String(yyyymm * 1000 + fallbackIdx + 1);
  }
  // Legacy numbers < 1_000_000 (old global sequence) — keep 4-digit display
  if (ticketNumber < 1_000_000) return String(ticketNumber).padStart(4, "0");
  // New monthly format: 202605001
  return String(ticketNumber);
}

const TICKET_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; }
  .ticket {
    width: 130mm;
    min-height: 190mm;
    padding: 8mm 8mm 6mm;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px;
    background: #fff;
    color: #111;
    display: flex;
    flex-direction: column;
  }
  /* ── Header ── */
  .header {
    text-align: center;
    padding-bottom: 4mm;
    border-bottom: 2px solid #111;
    margin-bottom: 4mm;
  }
  .header-name {
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 2mm;
  }
  .header-owner {
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 0.8mm;
  }
  .header-nif {
    font-size: 9px;
    color: #555;
    margin-bottom: 0.8mm;
  }
  .header-contact {
    font-size: 9px;
    color: #555;
    margin-bottom: 0.5mm;
  }
  .header-city {
    font-size: 9px;
    color: #555;
  }
  /* ── Ticket meta row ── */
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 3mm;
    margin-bottom: 3.5mm;
    border-bottom: 1px solid #ddd;
  }
  .ticket-num-label { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5mm; }
  .ticket-num-val   { font-size: 20px; font-weight: 900; color: #111; line-height: 1; }
  .ticket-date-label { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 1px; text-align: right; margin-bottom: 0.5mm; }
  .ticket-date-val   { font-size: 12px; font-weight: 700; text-align: right; }
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
    font-size: 7.5px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #777;
    padding: 0 1.5mm 1.5mm;
    text-align: left;
  }
  .items th.col-price { text-align: right; }
  .items td {
    padding: 2.5mm 1.5mm;
    vertical-align: top;
  }
  .items .col-concept { width: auto; }
  .items .col-time    { width: 24mm; color: #555; font-size: 9px; white-space: nowrap; }
  .items .col-price   { width: 18mm; text-align: right; font-weight: 600; }
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
  .total-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; }
  .total-val   { font-size: 18px; font-weight: 900; color: #111; }
  /* ── Footer ── */
  .footer {
    margin-top: auto;
    padding-top: 5mm;
    text-align: center;
    font-size: 9px;
    color: #888;
    border-top: 1px dashed #ccc;
    letter-spacing: 0.5px;
    line-height: 1.7;
  }
`;

function buildTicketHtml(appt: Appointment, idx: number, salon: SalonInfo) {
  const num = formatTicketNum(appt.ticket_number ?? null, idx);
  const dateStr = fmtDate(appt.starts_at);
  const timeStr = `${fmtTime(appt.starts_at)} – ${fmtTime(appt.ends_at)}`;
  const price = appt.price;
  const priceStr = price != null ? `${price.toFixed(2)} €` : "—";

  const contactParts: string[] = [];
  if (salon.address) contactParts.push(salon.address);
  if (salon.phone) contactParts.push(`Telf: ${salon.phone}`);
  const contactLine = contactParts.join("  ·  ");

  return `
<div class="ticket">
  <div class="header">
    <div class="header-name">${salon.name}</div>
    ${salon.owner ? `<div class="header-owner">${salon.owner}</div>` : ""}
    ${salon.nif ? `<div class="header-nif">${salon.nif}</div>` : ""}
    ${contactLine ? `<div class="header-contact">${contactLine}</div>` : ""}
    ${salon.city ? `<div class="header-city">${salon.city}</div>` : ""}
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

  const salonInfo: SalonInfo = salon ?? { name: "Salón" };

  // A5 portrait: 148 × 210 mm
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });

  for (let i = 0; i < appointments.length; i++) {
    const ticketHtml = buildTicketHtml(appointments[i], i, salonInfo);

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
