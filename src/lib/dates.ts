/**
 * Utilidades de fecha conscientes de la zona horaria del restaurante.
 *
 * Todo se guarda en UTC en la base de datos, pero un "día de servicio" es un
 * día natural en Europe/Madrid. Consultar con `starts_at >= 'YYYY-MM-DDT00:00Z'`
 * es incorrecto: en horario de verano (UTC+2) esa ventana incluye las 00:00–02:00
 * del día siguiente en Madrid y excluye las 00:00–02:00 del propio día.
 *
 * Para un restaurante español que cierra a la 01:00 eso significa:
 *   - reservas de madrugada mostradas en el día equivocado, y
 *   - reservas de madrugada EXCLUIDAS del cálculo de solapamiento al asignar
 *     mesa automáticamente → doble reserva de la misma mesa.
 */

export const RESTAURANT_TIMEZONE = "Europe/Madrid";

/**
 * Desplazamiento UTC (en minutos) de la zona horaria dada en un instante dado.
 * Positivo al este de Greenwich (Madrid en verano = +120).
 */
export function timezoneOffsetMinutes(at: Date, timeZone = RESTAURANT_TIMEZONE): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  // `hour` puede venir como 24 para medianoche en algunos runtimes.
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * Convierte una fecha+hora local ("2026-08-02", "20:30") de la zona del
 * restaurante al instante UTC correspondiente.
 *
 * Resuelve el desplazamiento de forma iterativa para ser correcto también en
 * los días de cambio de hora.
 */
export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone = RESTAURANT_TIMEZONE,
): Date {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, h, m, 0);

  // Primera aproximación con el offset en ese instante "ingenuo", y una
  // segunda pasada para corregir si la primera cayó al otro lado de un cambio
  // de hora.
  let offset = timezoneOffsetMinutes(new Date(naiveUtc), timeZone);
  let result = new Date(naiveUtc - offset * 60000);
  const offset2 = timezoneOffsetMinutes(result, timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    result = new Date(naiveUtc - offset * 60000);
  }
  return result;
}

/**
 * Ventana UTC [from, to) que cubre exactamente el día natural `date`
 * en la zona horaria del restaurante.
 *
 * Ejemplo (Madrid, CEST): "2026-08-02" →
 *   from = 2026-08-01T22:00:00.000Z
 *   to   = 2026-08-02T22:00:00.000Z
 */
export function madridDayRangeUtc(
  date: string,
  timeZone = RESTAURANT_TIMEZONE,
): { from: string; to: string } {
  const start = localDateTimeToUtc(date, "00:00", timeZone);
  const end = localDateTimeToUtc(addDays(date, 1), "00:00", timeZone);
  return { from: start.toISOString(), to: end.toISOString() };
}

/**
 * Ventana UTC [from, to) que cubre el rango inclusivo de días naturales
 * `fromDate`..`toDate` en la zona horaria del restaurante.
 */
export function madridRangeUtc(
  fromDate: string,
  toDate: string,
  timeZone = RESTAURANT_TIMEZONE,
): { from: string; to: string } {
  return {
    from: madridDayRangeUtc(fromDate, timeZone).from,
    to: madridDayRangeUtc(toDate, timeZone).to,
  };
}

/** Suma días a una fecha "YYYY-MM-DD" sin tocar zonas horarias. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Devuelve "YYYY-MM-DD" del instante dado en la zona del restaurante. */
export function toLocalDate(date: Date, timeZone = RESTAURANT_TIMEZONE): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/**
 * Día de la semana (0=domingo … 6=sábado) de una fecha "YYYY-MM-DD".
 * Calculado en UTC puro para que no dependa de la zona del servidor.
 */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
