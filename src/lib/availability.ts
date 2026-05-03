import {
  addMinutes,
  roundToInterval,
} from "@/lib/utils";
import type {
  BusinessHours,
  Service,
  StaffMember,
  StaffTimeOff,
  Appointment,
  TimeSlot,
} from "@/types";

export interface AvailabilityInput {
  date: string; // YYYY-MM-DD in Europe/Madrid
  service: Service;
  businessHours: BusinessHours[];
  staffMembers: StaffMember[];
  existingAppointments: Appointment[];
  staffTimeOffs: StaffTimeOff[];
  slotIntervalMinutes?: number;
  staffId?: string; // if specified, only check this staff member
}

export interface StaffSlot {
  staffId: string;
  staffName: string;
  slots: TimeSlot[];
}

export function computeAvailableSlots(input: AvailabilityInput): TimeSlot[] {
  const {
    date,
    service,
    businessHours,
    staffMembers,
    existingAppointments,
    staffTimeOffs,
    slotIntervalMinutes = 15,
    staffId,
  } = input;

  const targetStaff = staffId
    ? staffMembers.filter((s) => s.id === staffId)
    : staffMembers;

  if (targetStaff.length === 0) return [];

  const allSlots: TimeSlot[] = [];
  const now = new Date();

  for (const staff of targetStaff) {
    const salonHours = getSalonHoursForDate(businessHours, date);
    if (!salonHours || !salonHours.is_open) continue;

    if (isStaffOnTimeOff(staff.id, date, staffTimeOffs)) continue;

    const openTime = parseTimeOnDate(date, salonHours.open_time);
    const closeTime = parseTimeOnDate(date, salonHours.close_time);

    const totalDuration =
      service.buffer_before_minutes +
      service.duration_minutes +
      service.buffer_after_minutes;

    let cursor = roundToInterval(openTime, slotIntervalMinutes);

    while (addMinutes(cursor, totalDuration) <= closeTime) {
      const slotStart = addMinutes(cursor, service.buffer_before_minutes);
      const slotEnd = addMinutes(slotStart, service.duration_minutes);
      const effectiveEnd = addMinutes(cursor, totalDuration);

      if (cursor <= now) {
        cursor = addMinutes(cursor, slotIntervalMinutes);
        continue;
      }

      const hasConflict = existingAppointments.some((appt) => {
        if (appt.staff_id !== staff.id) return false;
        if (!["pending", "confirmed"].includes(appt.status)) return false;
        const apptStart = new Date(appt.starts_at);
        const apptEnd = new Date(appt.ends_at);
        return cursor < apptEnd && effectiveEnd > apptStart;
      });

      if (!hasConflict) {
        allSlots.push({
          starts_at: slotStart,
          ends_at: slotEnd,
          available: true,
          staff_id: staff.id,
        });
      }

      cursor = addMinutes(cursor, slotIntervalMinutes);
    }
  }

  // Deduplicate by start time, prefer first available staff (deterministic)
  const seen = new Set<string>();
  return allSlots.filter((slot) => {
    const key = slot.starts_at.toISOString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSalonHoursForDate(
  hours: BusinessHours[],
  date: string,
): BusinessHours | undefined {
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  return hours.find(
    (h) => h.staff_id === null && h.day_of_week === dayOfWeek,
  );
}

function parseTimeOnDate(date: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  // Parse the date in Europe/Madrid timezone
  const d = new Date(`${date}T${time}:00`);
  // We work in UTC representation of Madrid time for simplicity
  // In production, use date-fns-tz for proper timezone handling
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function isStaffOnTimeOff(
  staffId: string,
  date: string,
  timeOffs: StaffTimeOff[],
): boolean {
  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(date + "T23:59:59");

  return timeOffs.some((off) => {
    if (off.staff_id !== staffId) return false;
    const offStart = new Date(off.starts_at);
    const offEnd = new Date(off.ends_at);
    return offStart <= dayEnd && offEnd >= dayStart;
  });
}

export function pickDeterministicStaff(
  slots: TimeSlot[],
  targetStartsAt: Date,
): string | undefined {
  const matching = slots.filter(
    (s) => s.starts_at.getTime() === targetStartsAt.getTime() && s.staff_id,
  );
  if (matching.length === 0) return undefined;
  // Sort by staff_id for determinism
  matching.sort((a, b) => (a.staff_id! < b.staff_id! ? -1 : 1));
  return matching[0].staff_id;
}
