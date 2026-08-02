import { addMinutes } from "@/lib/utils";
import { localDateTimeToUtc, dayOfWeek, toLocalDate, addDays } from "@/lib/dates";
import type { BusinessHours, BlockedDay, RestaurantTable, Reservation, TimeSlot } from "@/types";

/** Estados que NO ocupan mesa. */
const RELEASING_STATUSES = new Set(["cancelled", "no_show"]);

/** Máximo de mesas que se pueden juntar para un grupo grande. */
export const MAX_TABLES_PER_COMBINATION = 3;

export interface AvailabilityInput {
  date: string;             // YYYY-MM-DD (día natural en la zona del restaurante)
  partySize: number;
  businessHours: BusinessHours[];
  existingReservations: Reservation[];
  blockedDays: BlockedDay[];
  tables: RestaurantTable[];
  durationMinutes: number;
  slotIntervalMinutes?: number;
  /** Pacing: máximo de comensales que pueden sentarse en la misma franja. null = sin límite. */
  maxCoversPerSlot?: number | null;
  /** Permitir juntar mesas para grupos que no caben en una sola. */
  allowCombining?: boolean;
  /**
   * Minutos antes del cierre en los que aún se acepta una entrada.
   * 0 = la reserva debe caber entera dentro del turno.
   */
  lastSeatingOffsetMinutes?: number;
  /** Zona horaria del restaurante. */
  timeZone?: string;
  /** Inyectable para tests. Por defecto, ahora. */
  now?: Date;
}

/**
 * Duración de una reserva según el tamaño del grupo.
 * Un grupo grande ocupa la mesa bastante más que una pareja.
 */
export function durationForParty(
  partySize: number,
  rules: {
    durationMinutes: number;
    largePartyThreshold?: number | null;
    largePartyDurationMinutes?: number | null;
  },
): number {
  const threshold = rules.largePartyThreshold ?? 0;
  if (
    threshold > 0 &&
    partySize >= threshold &&
    rules.largePartyDurationMinutes &&
    rules.largePartyDurationMinutes > 0
  ) {
    return rules.largePartyDurationMinutes;
  }
  return rules.durationMinutes;
}

/**
 * Devuelve los slots disponibles para la fecha + tamaño de grupo dados.
 *
 * Un slot está disponible si:
 *  - cae dentro de un turno del horario del restaurante,
 *  - existe una mesa (o combinación de mesas juntables) libre en ese tramo, y
 *  - no se supera el pacing de comensales de la franja.
 */
export function computeAvailableSlots(input: AvailabilityInput): TimeSlot[] {
  const {
    date,
    partySize,
    businessHours,
    existingReservations,
    blockedDays,
    tables,
    durationMinutes,
    slotIntervalMinutes = 30,
    maxCoversPerSlot = null,
    allowCombining = true,
    lastSeatingOffsetMinutes = 0,
    timeZone,
    now = new Date(),
  } = input;

  if (blockedDays.some((d) => d.date === date)) return [];

  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek(date));
  if (!hours || !hours.is_open) return [];

  const activeTables = tables.filter((t) => t.active);
  if (activeTables.length === 0) return [];

  // Si ninguna mesa individual ni combinación posible alcanza el tamaño del
  // grupo, no hay nada que calcular.
  if (maxSeatableParty(activeTables, allowCombining) < partySize) return [];

  const ranges = businessHourRanges(date, hours, timeZone);
  const slots: TimeSlot[] = [];
  const seen = new Set<string>();

  for (const { open, close } of ranges) {
    // Última entrada admitida en este turno. Con offset 0 se mantiene el
    // criterio clásico: la reserva entera tiene que caber antes del cierre.
    const lastSeating =
      lastSeatingOffsetMinutes > 0
        ? addMinutes(close, -lastSeatingOffsetMinutes)
        : addMinutes(close, -durationMinutes);

    let cursor = roundToSlot(open, slotIntervalMinutes);
    while (cursor <= lastSeating) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      const key = cursor.toISOString();

      // No ofrecer horas pasadas.
      if (cursor <= now || seen.has(key)) {
        cursor = addMinutes(cursor, slotIntervalMinutes);
        continue;
      }
      seen.add(key);

      const pacingOk = withinPacing(
        existingReservations,
        cursor,
        slotIntervalMinutes,
        partySize,
        maxCoversPerSlot,
      );

      const assignment = pacingOk
        ? assignTables(activeTables, existingReservations, partySize, cursor, slotEnd, allowCombining)
        : null;

      slots.push({
        starts_at: cursor,
        ends_at: slotEnd,
        available: assignment !== null,
        available_tables: assignment
          ? countFreeTablesFitting(activeTables, existingReservations, partySize, cursor, slotEnd)
          : 0,
      });

      cursor = addMinutes(cursor, slotIntervalMinutes);
    }
  }

  return slots.filter((s) => s.available);
}

/** Aforo máximo servible: la mesa más grande, o la suma de las N mayores juntables. */
function maxSeatableParty(tables: RestaurantTable[], allowCombining: boolean): number {
  if (tables.length === 0) return 0;
  const largest = Math.max(...tables.map((t) => t.capacity));
  if (!allowCombining) return largest;

  let best = largest;
  for (const section of new Set(tables.map((t) => t.section))) {
    const combinable = tables
      .filter((t) => t.section === section && t.combinable !== false)
      .map((t) => t.capacity)
      .sort((a, b) => b - a)
      .slice(0, MAX_TABLES_PER_COMBINATION);
    const sum = combinable.reduce((a, b) => a + b, 0);
    if (sum > best) best = sum;
  }
  return best;
}

/**
 * Pacing: comprueba que añadir `partySize` comensales en la franja que empieza
 * en `slotStart` no supera `maxCoversPerSlot`.
 *
 * Cuenta las reservas cuya hora de inicio cae dentro de la franja — es la
 * definición de "sentadas simultáneas" que usan los sistemas de sala: lo que
 * satura la cocina son las entradas a la vez, no los cubiertos totales.
 */
export function withinPacing(
  reservations: Reservation[],
  slotStart: Date,
  slotIntervalMinutes: number,
  partySize: number,
  maxCoversPerSlot: number | null,
): boolean {
  if (!maxCoversPerSlot || maxCoversPerSlot <= 0) return true;

  const from = slotStart.getTime();
  const to = addMinutes(slotStart, slotIntervalMinutes).getTime();

  let covers = 0;
  for (const r of reservations) {
    if (RELEASING_STATUSES.has(r.status)) continue;
    const rs = new Date(r.starts_at).getTime();
    if (rs >= from && rs < to) covers += r.party_size;
  }
  return covers + partySize <= maxCoversPerSlot;
}

/** Mesas individuales libres en las que cabe el grupo. */
function countFreeTablesFitting(
  tables: RestaurantTable[],
  reservations: Reservation[],
  partySize: number,
  start: Date,
  end: Date,
): number {
  return freeTables(tables, reservations, start, end).filter((t) => t.capacity >= partySize).length;
}

/** Mesas activas sin reserva solapando [start, end). */
export function freeTables(
  tables: RestaurantTable[],
  reservations: Reservation[],
  start: Date,
  end: Date,
): RestaurantTable[] {
  const startMs = start.getTime();
  const endMs = end.getTime();

  const occupied = new Set<string>();
  for (const r of reservations) {
    if (RELEASING_STATUSES.has(r.status)) continue;
    const rs = new Date(r.starts_at).getTime();
    const re = new Date(r.ends_at).getTime();
    if (rs < endMs && re > startMs) {
      for (const id of reservationTableIds(r)) occupied.add(id);
    }
  }

  return tables.filter((t) => t.active && !occupied.has(t.id));
}

/** IDs de todas las mesas ocupadas por una reserva (soporta mesas juntadas). */
export function reservationTableIds(r: Reservation): string[] {
  if (r.table_ids && r.table_ids.length > 0) return r.table_ids;
  return r.table_id ? [r.table_id] : [];
}

/**
 * Elige la asignación óptima de mesas para el grupo en [start, end).
 *
 * Prioridad:
 *  1. La mesa individual más ajustada (menos plazas desperdiciadas) en la que
 *     el grupo respeta también la capacidad mínima de la mesa.
 *  2. Si no hay ninguna y se permite juntar, la combinación de menos mesas
 *     (y menos plazas sobrantes) dentro de una misma sala.
 *
 * Devuelve null si no cabe.
 */
export function assignTables(
  tables: RestaurantTable[],
  reservations: Reservation[],
  partySize: number,
  start: Date,
  end: Date,
  allowCombining = true,
): RestaurantTable[] | null {
  const available = freeTables(tables, reservations, start, end);

  // 1. Mesa individual, la más ajustada. Se prefiere respetar min_capacity
  //    (no sentar a 2 personas en una mesa de 8 si hay algo mejor).
  const fits = available
    .filter((t) => t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity || a.sort_order - b.sort_order);

  const respectsMin = fits.filter((t) => partySize >= (t.min_capacity ?? 1));
  const single = respectsMin[0] ?? fits[0];
  if (single) return [single];

  if (!allowCombining) return null;

  // 2. Combinación de mesas juntables dentro de la misma sala.
  return bestCombination(available, partySize);
}

/**
 * Compatibilidad hacia atrás: devuelve solo la primera mesa de la asignación.
 * El código nuevo debería usar `assignTables`.
 */
export function findBestTable(
  tables: RestaurantTable[],
  reservations: Reservation[],
  partySize: number,
  start: Date,
  end: Date,
): RestaurantTable | null {
  const assignment = assignTables(tables, reservations, partySize, start, end, false);
  return assignment?.[0] ?? null;
}

/**
 * Mejor combinación de mesas juntables de una misma sala.
 * Busca exhaustivamente hasta MAX_TABLES_PER_COMBINATION mesas y se queda con
 * la que use menos mesas y desperdicie menos plazas.
 */
export function bestCombination(
  available: RestaurantTable[],
  partySize: number,
): RestaurantTable[] | null {
  let best: RestaurantTable[] | null = null;
  let bestScore = Infinity;

  for (const section of new Set(available.map((t) => t.section))) {
    const pool = available
      .filter((t) => t.section === section && t.combinable !== false)
      .sort((a, b) => b.capacity - a.capacity || a.sort_order - b.sort_order)
      // Un grupo nunca necesita más mesas que las N mayores de la sala.
      .slice(0, 8);

    const combos = combinationsUpTo(pool, MAX_TABLES_PER_COMBINATION);
    for (const combo of combos) {
      if (combo.length < 2) continue; // el caso de 1 mesa ya se resolvió antes
      const seats = combo.reduce((sum, t) => sum + t.capacity, 0);
      if (seats < partySize) continue;
      // Menos mesas primero; a igualdad, menos plazas sobrantes.
      const score = combo.length * 1000 + (seats - partySize);
      if (score < bestScore) {
        bestScore = score;
        best = combo;
      }
    }
  }

  return best;
}

function combinationsUpTo<T>(items: T[], maxSize: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, current: T[]) => {
    if (current.length > 0) result.push([...current]);
    if (current.length === maxSize) return;
    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      walk(i + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return result;
}

/**
 * Turnos del día como instantes UTC.
 * Si la hora de cierre es menor o igual a la de apertura, se interpreta que el
 * turno termina de madrugada del día siguiente (p. ej. 20:30 → 01:00).
 */
export function businessHourRanges(
  date: string,
  hours: BusinessHours,
  timeZone?: string,
): { open: Date; close: Date }[] {
  const ranges: { open: Date; close: Date }[] = [];
  const push = (openAt: string | null, closeAt: string | null) => {
    if (!openAt || !closeAt) return;
    const open = parseTimeOnDate(date, openAt, timeZone);
    let close = parseTimeOnDate(date, closeAt, timeZone);
    if (close <= open) close = parseTimeOnDate(addDays(date, 1), closeAt, timeZone);
    ranges.push({ open, close });
  };
  push(hours.opens_at, hours.closes_at);
  push(hours.opens_at_2, hours.closes_at_2);
  return ranges;
}

/**
 * Interpreta "HH:MM" (o "HH:MM:SS", como devuelve Supabase) del día `date`
 * en la zona del restaurante y devuelve el instante UTC equivalente.
 */
export function parseTimeOnDate(date: string, time: string, timeZone?: string): Date {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return localDateTimeToUtc(
    date,
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    timeZone,
  );
}

function roundToSlot(date: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Verifica que [startsAt, endsAt) cabe entero dentro de un turno del horario.
 *
 * Comprueba el día natural de la reserva y también el anterior, para que una
 * reserva de madrugada (p. ej. 00:30) valide contra el turno de noche del día
 * previo, que es al que realmente pertenece.
 */
export function isWithinBusinessHours(
  startsAt: Date,
  endsAt: Date,
  businessHours: BusinessHours[],
  opts: { lastSeatingOffsetMinutes?: number; timeZone?: string } = {},
): boolean {
  return resolveServiceDate(startsAt, endsAt, businessHours, opts) !== null;
}

/**
 * Día de servicio al que pertenece la reserva: el del TURNO que la contiene,
 * que no siempre es el día del reloj.
 *
 * Una cena de sábado que va de 20:30 a 01:00 sirve reservas cuyo instante cae
 * ya en domingo; esas reservas pertenecen al servicio del **sábado**. Usar el
 * día natural haría que cerrar el domingo cancelase la cola de la cena del
 * sábado, y que se le aplicase el pacing del domingo.
 *
 * Devuelve null si el tramo no cabe en ningún turno.
 */
export function resolveServiceDate(
  startsAt: Date,
  endsAt: Date,
  businessHours: BusinessHours[],
  opts: { lastSeatingOffsetMinutes?: number; timeZone?: string } = {},
): string | null {
  const { lastSeatingOffsetMinutes = 0, timeZone } = opts;
  const localDate = toLocalDate(startsAt, timeZone);

  // Se prueba el día del reloj y el anterior: son los únicos turnos que pueden
  // contener el instante.
  for (const date of [localDate, addDays(localDate, -1)]) {
    const hours = businessHours.find((h) => h.day_of_week === dayOfWeek(date));
    if (!hours || !hours.is_open) continue;

    const fits = businessHourRanges(date, hours, timeZone).some(({ open, close }) => {
      if (startsAt < open) return false;
      // Con última sentada configurada basta con que la ENTRADA sea a tiempo:
      // la sobremesa puede pasar de la hora de cierre.
      if (lastSeatingOffsetMinutes > 0) {
        return startsAt <= addMinutes(close, -lastSeatingOffsetMinutes);
      }
      return endsAt <= close;
    });

    if (fits) return date;
  }

  return null;
}
