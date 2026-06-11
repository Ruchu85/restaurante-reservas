import { addMinutes, roundToInterval } from "@/lib/utils";
import type { BusinessHours, Appointment, BlockedDay } from "@/types";

export interface SlotInput {
  date: string;             // YYYY-MM-DD
  durationMinutes: number;
  businessHours: BusinessHours[];
  existingAppointments: Appointment[];
  blockedDays: BlockedDay[];
  staffId?: string;
  slotIntervalMinutes?: number;
  /** Clientes simultáneos permitidos por tramo (capacidad). Por defecto 1. */
  capacity?: number;
}

export interface TimeSlotResult {
  starts_at: Date;
  ends_at: Date;
  /** Huecos libres restantes en el tramo (capacidad − ocupación). */
  remaining: number;
}

/**
 * Cuenta cuántas citas activas solapan el rango [start, end).
 * Si se pasa staffId, solo cuenta las de ese profesional.
 */
export function countOverlapping(
  appointments: Pick<Appointment, "starts_at" | "ends_at" | "status" | "staff_id">[],
  start: Date,
  end: Date,
  staffId?: string,
): number {
  let count = 0;
  for (const appt of appointments) {
    if (appt.status !== "active") continue;
    if (staffId && appt.staff_id !== staffId) continue;
    const s = new Date(appt.starts_at);
    const e = new Date(appt.ends_at);
    if (start < e && end > s) count++;
  }
  return count;
}

export function computeAvailableSlots(input: SlotInput): TimeSlotResult[] {
  const {
    date,
    durationMinutes,
    businessHours,
    existingAppointments,
    blockedDays,
    staffId,
    slotIntervalMinutes = 15,
    capacity = 1,
  } = input;

  // Reject blocked days
  const isBlocked = blockedDays.some((d) => d.date === date);
  if (isBlocked) return [];

  // Find salon hours for this day
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || !hours.is_open) return [];

  const ranges = businessHourRanges(date, hours);
  const cap = capacity > 0 ? capacity : 1;
  const now = new Date();
  const slots: TimeSlotResult[] = [];

  for (const { open: openTime, close: closeTime } of ranges) {
    let cursor = roundToInterval(openTime, slotIntervalMinutes);

    while (addMinutes(cursor, durationMinutes) <= closeTime) {
      const slotEnd = addMinutes(cursor, durationMinutes);

      if (cursor <= now) {
        cursor = addMinutes(cursor, slotIntervalMinutes);
        continue;
      }

      const occupied = countOverlapping(existingAppointments, cursor, slotEnd, staffId);
      const remaining = cap - occupied;

      if (remaining > 0) {
        slots.push({ starts_at: cursor, ends_at: slotEnd, remaining });
      }

      cursor = addMinutes(cursor, slotIntervalMinutes);
    }
  }

  return slots;
}

export function isWithinBusinessHours(
  startsAt: Date,
  endsAt: Date,
  businessHours: BusinessHours[],
): boolean {
  const dayOfWeek = startsAt.getDay();
  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || !hours.is_open) return false;

  const date = startsAt.toISOString().split("T")[0];
  return businessHourRanges(date, hours).some(
    ({ open, close }) => startsAt >= open && endsAt <= close,
  );
}

/**
 * Devuelve los tramos abiertos del día (uno o dos si hay turno partido).
 */
export function businessHourRanges(
  date: string,
  hours: BusinessHours,
): { open: Date; close: Date }[] {
  const ranges = [
    { open: parseTimeOnDate(date, hours.opens_at), close: parseTimeOnDate(date, hours.closes_at) },
  ];
  if (hours.opens_at_2 && hours.closes_at_2) {
    ranges.push({
      open: parseTimeOnDate(date, hours.opens_at_2),
      close: parseTimeOnDate(date, hours.closes_at_2),
    });
  }
  return ranges;
}

function parseTimeOnDate(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}
