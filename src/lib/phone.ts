/**
 * Normalización de teléfonos españoles y detección de móvil.
 *
 * El teléfono es la clave natural del comensal en el CRM: si no se normaliza,
 * "600 11 22 33", "+34600112233" y "0034 600112233" crean tres fichas distintas
 * para la misma persona.
 */

const DEFAULT_COUNTRY_CODE = "34";

/**
 * Devuelve el teléfono en formato E.164 (+34600112233) cuando puede
 * interpretarse, o el original recortado si no.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let digits = trimmed.replace(/[^\d+]/g, "");

  if (digits.startsWith("00")) digits = "+" + digits.slice(2);

  if (digits.startsWith("+")) {
    return digits.length >= 8 ? digits : trimmed;
  }

  // 9 dígitos sin prefijo → número nacional español.
  if (/^\d{9}$/.test(digits)) return `+${DEFAULT_COUNTRY_CODE}${digits}`;

  // Ya lleva el prefijo pero sin "+".
  if (/^34\d{9}$/.test(digits)) return `+${digits}`;

  return digits || trimmed;
}

/** Móvil español: 9 dígitos que empiezan por 6 o 7. Solo esos tienen WhatsApp. */
export function isSpanishMobile(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = normalizePhone(phone).replace(/\D/g, "").replace(/^34/, "");
  return /^[67]\d{8}$/.test(digits);
}

/** Formato legible español: "+34 600 11 22 33". */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const e164 = normalizePhone(phone);
  const m = /^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (!m) return e164;
  return `+34 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}

/**
 * Enlace wa.me con mensaje prerrellenado.
 * Devuelve null si el número no puede recibir WhatsApp (fijo español).
 */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const e164 = normalizePhone(phone);
  const digits = e164.replace(/\D/g, "");
  if (!digits) return null;
  // Los fijos españoles (8xx/9xx) no tienen WhatsApp: no generamos enlace.
  if (digits.startsWith("34") && !isSpanishMobile(e164)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
