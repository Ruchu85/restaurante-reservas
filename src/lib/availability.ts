import { addMinutes } from "@/lib/utils";
import type { BusinessHours, BlockedDay, RestaurantTable, Reservation, TimeSlot } from "@/types";

export interface AvailabilityInput {
  date: string;             // YYYY-MM-DD
  partySize: number;
  businessHours: BusinessHours[];
  existingReservations: Reservation[];
  blockedDays: BlockedDay[];
  tables: RestaurantTable[];
  durationMinutes: number;
  slotIntervalMinutes?: number;
}

/**
 * Devuelve slots disponibles para la fecha + party size dada.
 * Un slot está disponible si existe al menos una mesa con capacity >= partySize
 * y que no tenga reserva activa solapando ese tramo.
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
  } = input;

  if (blockedDays.some((d) => d.date === date)) return [];

  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || !hours.is_open) return [];

  const eligibleTables = tables.filter(
    (t) => t.active && t.capacity >= partySize,
  );
  if (eligibleTables.length === 0) return [];

  const ranges = businessHourRanges(date, hours);
  const now = new Date();
  const slots: TimeSlot[] = [];
  const seen = new Set<string>();

  for (const { open, close } of ranges) {
    let cursor = roundToSlot(open, slotIntervalMinutes);
    while (addMinutes(cursor, durationMinutes) <= close) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      // Skip past slots
      if (cursor <= now) {
        cursor = addMinutes(cursor, slotIntervalMinutes);
        continue;
      }
      const key = cursor.toISOString();
      if (!seen.has(key)) {
        seen.add(key);
        const availableCount = countAvailableTables(
          eligibleTables,
          existingReservations,
          cursor,
          slotEnd,
        );
        slots.push({
          starts_at: cursor,
          ends_at: slotEnd,
          available: availableCount > 0,
          available_tables: availableCount,
        });
      }
      cursor = addMinutes(cursor, slotIntervalMinutes);
    }
  }

  return slots.filter((s) => s.available);
}

/**
 * Cuenta cuántas mesas elegibles están libres en [start, end).
 */
function countAvailableTables(
  tables: RestaurantTable[],
  reservations: Reservation[],
  start: Date,
  end: Date,
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  let free = 0;
  for (const table of tables) {
    const hasOverlap = reservations.some((r) => {
      if (r.table_id !== table.id) return false;
      if (r.status === "cancelled" || r.status === "no_show") return false;
      const rs = new Date(r.starts_at).getTime();
      const re = new Date(r.ends_at).getTime();
      return rs < endMs && re > startMs;
    });
    if (!hasOverlap) free++;
  }
  return free;
}

/**
 * Devuelve la mejor mesa disponible para el tramo (la más pequeña que cabe).
 */
export function findBestTable(
  tables: RestaurantTable[],
  reservations: Reservation[],
  partySize: number,
  start: Date,
  end: Date,
): RestaurantTable | null {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const eligible = tables
    .filter((t) => t.active && t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity);

  for (const table of eligible) {
    const occupied = reservations.some((r) => {
      if (r.table_id !== table.id) return false;
      if (r.status === "cancelled" || r.status === "no_show") return false;
      const rs = new Date(r.starts_at).getTime();
      const re = new Date(r.ends_at).getTime();
      return rs < endMs && re > startMs;
    });
    if (!occupied) return table;
  }
  return null;
}

export function businessHourRanges(
  date: string,
  hours: BusinessHours,
): { open: Date; close: Date }[] {
  const ranges: { open: Date; close: Date }[] = [];
  if (hours.opens_at && hours.closes_at) {
    ranges.push({
      open: parseTimeOnDate(date, hours.opens_at),
      close: parseTimeOnDate(date, hours.closes_at),
    });
  }
  if (hours.opens_at_2 && hours.closes_at_2) {
    ranges.push({
      open: parseTimeOnDate(date, hours.opens_at_2),
      close: parseTimeOnDate(date, hours.closes_at_2),
    });
  }
  return ranges;
}

function parseTimeOnDate(date: string, time: string): Date {
  // Interpret time as Europe/Madrid local time and return the UTC equivalent.
  // time may be "HH:MM" or "HH:MM:SS" (Supabase returns time cols as HH:MM:SS).
  const [h, m] = time.split(":").map(Number);
  const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  // Probe at noon to find Madrid's UTC offset (avoids DST-transition edge cases).
  const noonMadridHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(`${date}T12:00:00Z`)),
    10,
  );
  const offsetHours = noonMadridHour - 12; // e.g. +2 in CEST, +1 in CET
  const sign = offsetHours >= 0 ? "+" : "-";
  const pad = String(Math.abs(offsetHours)).padStart(2, "0");
  return new Date(`${date}T${hhmm}:00${sign}${pad}:00`);
}

function roundToSlot(date: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Verifica si el restaurante está abierto en el tramo dado.
 */
export function isWithinBusinessHours(
  startsAt: Date,
  endsAt: Date,
  businessHours: BusinessHours[],
): boolean {
  const madridDate = startsAt.toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).split(" ")[0];
  const dayOfWeek = new Date(madridDate + "T12:00:00Z").getDay();
  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || !hours.is_open) return false;
  const date = madridDate;
  return businessHourRanges(date, hours).some(
    ({ open, close }) => startsAt >= open && endsAt <= close,
  );
}
