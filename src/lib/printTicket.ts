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

const TICKET_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .ticket {
    width: 190mm;
    padding: 8mm 10mm;
    font-family: Arial, sans-serif;
    font-size: 11px;
    background: #fff;
  }
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
  .date-row { margin: 3mm 0 2mm; font-size: 12px; }
  .client-row { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 3mm; font-size: 12px; }
  .client-label { font-size: 14px; font-weight: bold; }
  .client-val { border-bottom: 1px solid #000; flex: 1; min-height: 5mm; }
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
  .col-price { width: 22mm; }
  .col-total { width: 24mm; }
  .empty-row td { height: 7mm; }
`;

function buildTicketHtml(
  appt: Appointment,
  idx: number,
  salonName: string,
  salonAddress: string,
  salonPhone: string,
) {
  const num = appt.ticket_number ?? (200 + idx + 1);
  const dateStr = fmtDateShort(appt.starts_at);
  const timeStr = `${fmtTime(appt.starts_at)} – ${fmtTime(appt.ends_at)}`;
  const priceStr = appt.price != null ? `${appt.price.toFixed(2)} €` : "";

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
        <td class="col-price">${priceStr}</td>
        <td class="col-total">${priceStr}</td>
      </tr>
      <tr><td></td><td>${timeStr}</td><td></td><td></td></tr>
      <tr class="empty-row"><td></td><td></td><td></td><td></td></tr>
      <tr class="empty-row"><td></td><td></td><td></td><td></td></tr>
      <tr class="empty-row"><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>
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

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });

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
      "position:fixed;left:-9999px;top:0;background:white;width:210mm;";
    wrapper.innerHTML = `<style>${TICKET_STYLES}</style>${ticketHtml}`;
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      if (i > 0) doc.addPage([210, 148], "landscape");

      const imgData = canvas.toDataURL("image/png");
      const pdfW = 210;
      const imgH = (canvas.height / canvas.width) * pdfW;
      doc.addImage(imgData, "PNG", 0, 0, pdfW, Math.min(imgH, 148));
    } finally {
      document.body.removeChild(wrapper);
    }
  }

  const dateStr = new Date().toLocaleDateString("es-ES").replace(/\//g, "-");
  doc.save(`tickets-${dateStr}.pdf`);
}

export const printTickets = downloadTicketsPDF;
