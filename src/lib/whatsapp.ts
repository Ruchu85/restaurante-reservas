import { normalizePhone, isSpanishMobile } from "@/lib/phone";
import type { Reservation } from "@/types";

/*
 * Envío automático de WhatsApp vía la API de Twilio.
 *
 * Sigue el mismo patrón que `email.ts`: mejor esfuerzo, nunca bloquea el
 * flujo de reserva, y no hace nada si faltan las credenciales — así el
 * proyecto funciona sin WhatsApp configurado y basta con añadir las env vars
 * para activarlo.
 *
 * Requiere tres variables de entorno:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM   — el remitente, en formato "whatsapp:+14155238886"
 *                            (número de sandbox) o el número propio aprobado.
 *
 * En el sandbox de Twilio, cada destinatario tiene que enviar antes
 * "join <código>" al número de sandbox desde su WhatsApp — si no, Twilio
 * devuelve error 63007/63016 y aquí simplemente no se envía nada (best-effort).
 */

const DEFAULT_TZ = "Europe/Madrid";

function formatDate(iso: string, timeZone = DEFAULT_TZ) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
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

function credentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

/** Solo se intenta con números que pueden tener WhatsApp: los fijos españoles no. */
function whatsAppTarget(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const e164 = normalizePhone(phone);
  if (e164.startsWith("+34") && !isSpanishMobile(e164)) return null;
  return e164;
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const creds = credentials();
  if (!creds) return;

  const params = new URLSearchParams({
    From: creds.from,
    To: `whatsapp:${to}`,
    Body: body,
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString("base64")}`,
        },
        body: params,
      },
    );
    if (!res.ok) {
      // Best-effort: un sandbox sin "join", un número no verificado o
      // Twilio caído no deben romper la reserva. Se deja constancia en logs
      // del servidor para poder diagnosticarlo.
      console.error("Twilio WhatsApp error", res.status, await res.text());
    }
  } catch (err) {
    console.error("Twilio WhatsApp fetch failed", err);
  }
}

interface WhatsAppParams {
  reservation: Reservation;
  restaurantName: string;
  restaurantPhone?: string | null;
  appUrl: string;
  timeZone?: string;
}

export async function sendConfirmationWhatsApp({
  reservation,
  restaurantName,
  restaurantPhone,
  appUrl,
  timeZone = DEFAULT_TZ,
}: WhatsAppParams): Promise<void> {
  const to = whatsAppTarget(reservation.guest_phone);
  if (!to) return;

  const date = formatDate(reservation.starts_at, timeZone);
  const time = formatTime(reservation.starts_at, timeZone);
  const cancelUrl = `${appUrl}/reservar/${reservation.confirmation_token}`;

  const body =
    `Hola ${reservation.guest_name} 👋 Tu reserva en *${restaurantName}* está confirmada.\n\n` +
    `📅 ${date}\n🕒 ${time} · ${reservation.party_size} ${reservation.party_size === 1 ? "persona" : "personas"}\n\n` +
    `Ver o cancelar: ${cancelUrl}` +
    (restaurantPhone ? `\n¿Dudas? Llámanos al ${restaurantPhone}.` : "");

  await sendWhatsApp(to, body);
}

export async function sendCancellationWhatsApp({
  reservation,
  restaurantName,
  appUrl,
  timeZone = DEFAULT_TZ,
}: Omit<WhatsAppParams, "restaurantPhone">): Promise<void> {
  const to = whatsAppTarget(reservation.guest_phone);
  if (!to) return;

  const date = formatDate(reservation.starts_at, timeZone);
  const time = formatTime(reservation.starts_at, timeZone);

  const body =
    `Hola ${reservation.guest_name}, hemos cancelado tu reserva en *${restaurantName}* ` +
    `del ${date} a las ${time}.\n\nPuedes hacer una nueva cuando quieras: ${appUrl}/reservar`;

  await sendWhatsApp(to, body);
}
