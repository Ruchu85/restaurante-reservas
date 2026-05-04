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
}

export interface TimeSlotResult {
  starts_at: Date;
  ends_at: Date;
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
  } = input;

  // Reject blocked days
  const isBlocked = blockedDays.some((d) => d.date === date);
  if (isBlocked) return [];

  // Find salon hours for this day
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek);
  if (!hours || !hours.is_open) return [];

  const openTime = parseTimeOnDate(date, hours.opens_at);
  const closeTime = parseTimeOnDate(date, hours.closes_at);

  const now = new Date();
  const slots: TimeSlotResult[] = [];
  let cursor = roundToInterval(openTime, slotIntervalMinutes);

  while (addMinutes(cursor, durationMinutes) <= closeTime) {
    const slotEnd = addMinutes(cursor, durationMinutes);

    if (cursor <= now) {
      cursor = addMinutes(cursor, slotIntervalMinutes);
      continue;
    }

    const hasConflict = existingAppointments.some((appt) => {
      if (staffId && appt.staff_id !== staffId) return false;
      if (appt.status !== "active") return false;
      const apptStart = new Date(appt.starts_at);
      const apptEnd = new Date(appt.ends_at);
      return cursor < apptEnd && slotEnd > apptStart;
    });

    if (!hasConflict) {
      slots.push({ starts_at: cursor, ends_at: slotEnd });
    }

    cursor = addMinutes(cursor, slotIntervalMinutes);
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
  const openTime = parseTimeOnDate(date, hours.opens_at);
  const closeTime = parseTimeOnDate(date, hours.closes_at);

  return startsAt >= openTime && endsAt <= closeTime;
}

function parseTimeOnDate(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}
