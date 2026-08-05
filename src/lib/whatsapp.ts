import { normalizePhone, isSpanishMobile } from "@/lib/phone";
import type { Reservation } from "@/types";

/*
 * Envío automático de WhatsApp vía la API de Meta (WhatsApp Cloud API).
 *
 * Sigue el mismo patrón que `email.ts`: mejor esfuerzo, nunca bloquea el
 * flujo de reserva, y no hace nada si faltan las credenciales.
 *
 * Requiere dos variables de entorno:
 *   META_WHATSAPP_TOKEN            — token permanente de un System User
 *   META_WHATSAPP_PHONE_NUMBER_ID  — el "Phone Number ID" de la app de Meta
 *                                     (no es el número de teléfono en sí)
 *
 * A diferencia de Twilio, Meta no admite texto libre para mensajes que
 * inicia el negocio (una confirmación de reserva no es una respuesta a un
 * mensaje del cliente): hay que usar una plantilla aprobada por Meta. Los
 * nombres de plantilla son fijos — se crean una vez con
 * `scripts/setup-whatsapp-templates.mjs` y no hace falta tocarlos más.
 */

const API_VERSION = "v20.0";
const TEMPLATE_CONFIRM = "reservation_confirmation";
const TEMPLATE_CANCEL = "reservation_cancellation";
const LANGUAGE = "es";

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
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

/** Solo se intenta con números que pueden tener WhatsApp: los fijos españoles no. */
function whatsAppTarget(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const e164 = normalizePhone(phone);
  if (e164.startsWith("+34") && !isSpanishMobile(e164)) return null;
  // Meta quiere el número sin el "+".
  return e164.replace(/^\+/, "");
}

async function sendTemplate(
  to: string,
  template: string,
  params: string[],
): Promise<void> {
  const creds = credentials();
  if (!creds) return;

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: LANGUAGE },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.token}`,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      // Best-effort: una plantilla aún no aprobada, un número fuera de la
      // lista de prueba o un fallo de Meta no deben romper la reserva.
      console.error("Meta WhatsApp error", res.status, await res.text());
    }
  } catch (err) {
    console.error("Meta WhatsApp fetch failed", err);
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
  appUrl,
  timeZone = DEFAULT_TZ,
}: WhatsAppParams): Promise<void> {
  const to = whatsAppTarget(reservation.guest_phone);
  if (!to) return;

  const date = formatDate(reservation.starts_at, timeZone);
  const time = formatTime(reservation.starts_at, timeZone);
  const cancelUrl = `${appUrl}/reservar/${reservation.confirmation_token}`;

  await sendTemplate(to, TEMPLATE_CONFIRM, [
    reservation.guest_name,
    restaurantName,
    date,
    time,
    String(reservation.party_size),
    cancelUrl,
  ]);
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

  await sendTemplate(to, TEMPLATE_CANCEL, [
    reservation.guest_name,
    restaurantName,
    date,
    time,
    `${appUrl}/reservar`,
  ]);
}
