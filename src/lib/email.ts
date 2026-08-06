import { Resend } from "resend";
import type { Reservation } from "@/types";

// Lazy — only instantiate when we actually have a key (avoids build-time crash)
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const DEFAULT_TZ = "Europe/Madrid";

function formatDate(iso: string, timeZone = DEFAULT_TZ) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

function formatTime(iso: string, timeZone = DEFAULT_TZ) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

/**
 * Escapa el texto que se interpola en el HTML del email.
 * `guest_name` es entrada pública: sin escapar, un "<" rompe el render.
 */
function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SendConfirmationParams {
  reservation: Reservation;
  restaurantName: string;
  restaurantPhone?: string | null;
  appUrl: string;
  timeZone?: string;
}

export async function sendConfirmationEmail({
  reservation,
  restaurantName,
  restaurantPhone,
  appUrl,
  timeZone = DEFAULT_TZ,
}: SendConfirmationParams): Promise<void> {
  if (!process.env.RESEND_API_KEY || !reservation.guest_email) return;
  if (!process.env.RESEND_FROM_EMAIL) return;

  const cancelUrl = `${appUrl}/reservar/${reservation.confirmation_token}`;
  const date = formatDate(reservation.starts_at, timeZone);
  const startTime = formatTime(reservation.starts_at, timeZone);
  const endTime = formatTime(reservation.ends_at, timeZone);
  const safeName = esc(reservation.guest_name);
  const safeRestaurant = esc(restaurantName);
  const safePhone = esc(restaurantPhone);
  const safeNotes = esc(reservation.notes);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reserva confirmada — ${safeRestaurant}</title>
</head>
<body style="margin:0;padding:0;background:#f9f6f2;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <!-- Header -->
    <tr>
      <td style="background:#d97706;padding:28px 32px;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${safeRestaurant}</h1>
        <p style="margin:6px 0 0;color:#fde68a;font-size:14px;">Reserva confirmada ✓</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 24px;color:#44403c;font-size:16px;">
          Hola <strong>${safeName}</strong>, tu reserva ha sido confirmada. Te esperamos.
        </p>

        <!-- Details box -->
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;margin-bottom:24px;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:12px;border-bottom:1px solid #e7e5e4;">
                    <div style="color:#78716c;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Fecha</div>
                    <div style="color:#1c1917;font-size:15px;font-weight:600;text-transform:capitalize;">${date}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e7e5e4;">
                    <div style="color:#78716c;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Hora</div>
                    <div style="color:#1c1917;font-size:15px;font-weight:600;">${startTime} – ${endTime}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <div style="color:#78716c;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Comensales</div>
                    <div style="color:#1c1917;font-size:15px;font-weight:600;">
                      ${reservation.party_size} ${reservation.party_size === 1 ? "persona" : "personas"}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${reservation.notes ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
          <div style="color:#92400e;font-size:12px;font-weight:600;margin-bottom:4px;">NOTA</div>
          <div style="color:#78350f;font-size:14px;">${safeNotes}</div>
        </div>
        ` : ""}

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${cancelUrl}"
             style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;
                    font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">
            Ver o cancelar mi reserva
          </a>
        </div>

        <p style="margin:0 0 8px;color:#78716c;font-size:13px;">
          Si necesitas cancelar, por favor hazlo con al menos <strong>2 horas de antelación</strong>
          desde el enlace de arriba.
          ${restaurantPhone ? `También puedes llamarnos al <strong>${safePhone}</strong>.` : ""}
        </p>

        <!-- Token -->
        <div style="background:#f5f5f4;border-radius:8px;padding:12px 16px;margin-top:24px;">
          <div style="color:#a8a29e;font-size:11px;margin-bottom:4px;">Código de reserva</div>
          <div style="font-family:monospace;font-size:12px;color:#57534e;word-break:break-all;">
            ${reservation.confirmation_token}
          </div>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#fafaf9;border-top:1px solid #e7e5e4;padding:20px 32px;">
        <p style="margin:0;color:#a8a29e;font-size:12px;text-align:center;">
          ${safeRestaurant} · Reservas online en <a href="${appUrl}" style="color:#d97706;">${appUrl.replace(/^https?:\/\//, "")}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Un correo con solo `html` y sin alternativa de texto plano es en sí
  // mismo una señal de spam para varios filtros (todo cliente de correo
  // "serio" manda las dos partes). No arregla la reputación de un dominio
  // recién creado, pero es lo único que sí depende de nuestro código.
  const text = [
    `${restaurantName} — Reserva confirmada`,
    ``,
    `Hola ${reservation.guest_name}, tu reserva ha sido confirmada. Te esperamos.`,
    ``,
    `Fecha: ${date}`,
    `Hora: ${startTime} – ${endTime}`,
    `Comensales: ${reservation.party_size}`,
    reservation.notes ? `Nota: ${reservation.notes}` : null,
    ``,
    `Ver o cancelar tu reserva: ${cancelUrl}`,
    `Puedes cancelar con al menos 2 horas de antelación.`,
    restaurantPhone ? `También puedes llamarnos al ${restaurantPhone}.` : null,
    ``,
    `Código de reserva: ${reservation.confirmation_token}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    // El SDK de Resend no lanza en errores de la API (dominio no verificado,
    // límite de tasa...): los devuelve en `{ error }` sin tocar `data`. Sin
    // comprobarlo, un envío que Resend rechaza queda indistinguible de uno
    // que ha ido bien — así se nos pasó por alto el primer fallo real.
    const { error } = await getResend()!.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: reservation.guest_email,
      subject: `Reserva confirmada — ${restaurantName} · ${startTime} del ${date}`,
      html,
      text,
    });
    if (error) console.error("Resend confirmation email error", error);
  } catch (err) {
    // Best-effort: un fallo de red no debe romper la reserva.
    console.error("Resend confirmation email fetch failed", err);
  }
}

export async function sendCancellationEmail({
  reservation,
  restaurantName,
  appUrl,
  timeZone = DEFAULT_TZ,
}: Omit<SendConfirmationParams, "restaurantPhone">): Promise<void> {
  if (!process.env.RESEND_API_KEY || !reservation.guest_email) return;
  if (!process.env.RESEND_FROM_EMAIL) return;

  const date = formatDate(reservation.starts_at, timeZone);
  const startTime = formatTime(reservation.starts_at, timeZone);
  const safeName = esc(reservation.guest_name);
  const safeRestaurant = esc(restaurantName);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><title>Reserva cancelada</title></head>
<body style="margin:0;padding:0;background:#f9f6f2;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <tr>
      <td style="background:#78716c;padding:28px 32px;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${safeRestaurant}</h1>
        <p style="margin:6px 0 0;color:#d6d3d1;font-size:14px;">Reserva cancelada</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;color:#44403c;font-size:16px;">
          Hola <strong>${safeName}</strong>, hemos cancelado tu reserva del
          <strong style="text-transform:capitalize;">${date}</strong> a las <strong>${startTime}</strong>.
        </p>
        <p style="margin:0 0 28px;color:#78716c;font-size:14px;">
          Esperamos verte pronto. Puedes hacer una nueva reserva cuando quieras.
        </p>
        <div style="text-align:center;">
          <a href="${appUrl}/reservar"
             style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;
                    font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">
            Hacer una nueva reserva
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#fafaf9;border-top:1px solid #e7e5e4;padding:16px 32px;">
        <p style="margin:0;color:#a8a29e;font-size:12px;text-align:center;">${safeRestaurant}</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    `${restaurantName} — Reserva cancelada`,
    ``,
    `Hola ${reservation.guest_name}, hemos cancelado tu reserva del ${date} a las ${startTime}.`,
    `Esperamos verte pronto. Puedes hacer una nueva reserva cuando quieras: ${appUrl}/reservar`,
  ].join("\n");

  try {
    const { error } = await getResend()!.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: reservation.guest_email,
      subject: `Reserva cancelada — ${restaurantName}`,
      html,
      text,
    });
    if (error) console.error("Resend cancellation email error", error);
  } catch (err) {
    console.error("Resend cancellation email fetch failed", err);
  }
}
