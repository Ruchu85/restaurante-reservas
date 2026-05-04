import { describe, it, expect } from "vitest";
import { computeAvailableSlots, isWithinBusinessHours } from "@/lib/availability";
import type { BusinessHours, Appointment, BlockedDay } from "@/types";

const SALON_ID = "salon-1";
const STAFF_ID = "staff-1";

// Monday 2026-06-01
const TEST_DATE = "2026-06-01";

const MONDAY_HOURS: BusinessHours = {
  id: "bh-1",
  salon_id: SALON_ID,
  day_of_week: 1,
  opens_at: "09:00",
  closes_at: "18:00",
  is_open: true,
};

function makeAppt(startsAt: string, endsAt: string, staffId = STAFF_ID): Appointment {
  return {
    id: crypto.randomUUID(),
    salon_id: SALON_ID,
    staff_id: staffId,
    customer_name: "Test",
    service: "Corte",
    starts_at: startsAt,
    ends_at: endsAt,
    notes: null,
    status: "active",
    created_at: "",
  };
}

describe("computeAvailableSlots", () => {
  it("returns slots within business hours", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [],
      blockedDays: [],
    });

    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      expect(slot.starts_at.getHours()).toBeGreaterThanOrEqual(9);
      const endTotal = slot.ends_at.getHours() * 60 + slot.ends_at.getMinutes();
      expect(endTotal).toBeLessThanOrEqual(18 * 60);
    });
  });

  it("returns no slots when salon is closed", () => {
    const closed: BusinessHours = { ...MONDAY_HOURS, is_open: false };
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [closed],
      existingAppointments: [],
      blockedDays: [],
    });
    expect(slots).toHaveLength(0);
  });

  it("returns no slots for blocked days", () => {
    const blocked: BlockedDay = {
      id: "bd-1",
      salon_id: SALON_ID,
      date: TEST_DATE,
      reason: "Festivo",
      created_at: "",
    };
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [],
      blockedDays: [blocked],
    });
    expect(slots).toHaveLength(0);
  });

  it("excludes slots that conflict with active appointments", () => {
    const appt = makeAppt(`${TEST_DATE}T10:00:00`, `${TEST_DATE}T11:00:00`);

    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [appt],
      blockedDays: [],
      staffId: STAFF_ID,
    });

    const conflicting = slots.find(
      (s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0,
    );
    expect(conflicting).toBeUndefined();
  });

  it("does not exclude slots for cancelled appointments", () => {
    const appt = { ...makeAppt(`${TEST_DATE}T10:00:00`, `${TEST_DATE}T11:00:00`), status: "cancelled" as const };

    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [appt],
      blockedDays: [],
      staffId: STAFF_ID,
    });

    const slot = slots.find(
      (s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0,
    );
    expect(slot).toBeDefined();
  });

  it("returns slots at 15-minute intervals by default", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 30,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [],
      blockedDays: [],
    });

    for (let i = 1; i < Math.min(slots.length, 5); i++) {
      const diff = slots[i].starts_at.getTime() - slots[i - 1].starts_at.getTime();
      expect(diff).toBe(15 * 60 * 1000);
    }
  });

  it("ignores appointments from different staff when staffId is set", () => {
    const otherStaffAppt = makeAppt(`${TEST_DATE}T10:00:00`, `${TEST_DATE}T11:00:00`, "other-staff");

    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [otherStaffAppt],
      blockedDays: [],
      staffId: STAFF_ID,
    });

    const slot = slots.find(
      (s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0,
    );
    expect(slot).toBeDefined();
  });
});

describe("isWithinBusinessHours", () => {
  it("returns true for a slot within hours", () => {
    const starts = new Date(`${TEST_DATE}T10:00:00`);
    const ends = new Date(`${TEST_DATE}T11:00:00`);
    expect(isWithinBusinessHours(starts, ends, [MONDAY_HOURS])).toBe(true);
  });

  it("returns false for a slot outside hours", () => {
    const starts = new Date(`${TEST_DATE}T07:00:00`);
    const ends = new Date(`${TEST_DATE}T08:00:00`);
    expect(isWithinBusinessHours(starts, ends, [MONDAY_HOURS])).toBe(false);
  });

  it("returns false when salon is closed", () => {
    const closed: BusinessHours = { ...MONDAY_HOURS, is_open: false };
    const starts = new Date(`${TEST_DATE}T10:00:00`);
    const ends = new Date(`${TEST_DATE}T11:00:00`);
    expect(isWithinBusinessHours(starts, ends, [closed])).toBe(false);
  });
});
