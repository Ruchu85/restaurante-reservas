import { describe, it, expect } from "vitest";
import { computeAvailableSlots, isWithinBusinessHours, parseTimeOnDate } from "@/lib/availability";
import type { BusinessHours, BlockedDay, RestaurantTable, Reservation } from "@/types";

const RESTAURANT_ID = "rest-1";

function nextTuesday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const TEST_DATE = nextTuesday(); // day_of_week = 2 (Tuesday)

const TUESDAY_HOURS: BusinessHours = {
  id: "bh-1",
  restaurant_id: RESTAURANT_ID,
  day_of_week: 2,
  is_open: true,
  opens_at: "13:30",
  closes_at: "16:00",
  opens_at_2: "20:30",
  closes_at_2: "23:30",
};

// Returns minutes since midnight in Europe/Madrid timezone for a given Date.
function madridMins(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return h * 60 + m;
}

function makeTable(id: string, capacity: number): RestaurantTable {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    name: `Mesa ${id}`,
    capacity,
    min_capacity: 1,
    section: "interior",
    active: true,
    sort_order: 0,
    created_at: "",
  };
}

function makeReservation(tableId: string, startsAt: string, endsAt: string): Reservation {
  return {
    id: crypto.randomUUID(),
    restaurant_id: RESTAURANT_ID,
    table_id: tableId,
    guest_name: "Test Guest",
    guest_phone: "600000000",
    guest_email: null,
    party_size: 2,
    starts_at: startsAt,
    ends_at: endsAt,
    notes: null,
    internal_notes: null,
    status: "confirmed",
    source: "online",
    confirmation_token: "tok",
    created_at: "",
    updated_at: "",
  };
}

const TABLES = [makeTable("t1", 2), makeTable("t2", 4), makeTable("t3", 6)];

const BASE_INPUT = {
  date: TEST_DATE,
  partySize: 2,
  businessHours: [TUESDAY_HOURS],
  existingReservations: [] as Reservation[],
  blockedDays: [] as BlockedDay[],
  tables: TABLES,
  durationMinutes: 90,
};

describe("computeAvailableSlots", () => {
  it("returns slots within business hours", () => {
    const slots = computeAvailableSlots(BASE_INPUT);
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      const startMin = madridMins(slot.starts_at);
      const endMin = madridMins(slot.ends_at);
      const inLunch = startMin >= 13 * 60 + 30 && endMin <= 16 * 60;
      const inDinner = startMin >= 20 * 60 + 30 && endMin <= 23 * 60 + 30;
      expect(inLunch || inDinner).toBe(true);
    });
  });

  it("returns no slots when restaurant is closed", () => {
    const closed: BusinessHours = { ...TUESDAY_HOURS, is_open: false };
    const slots = computeAvailableSlots({ ...BASE_INPUT, businessHours: [closed] });
    expect(slots).toHaveLength(0);
  });

  it("returns no slots for blocked days", () => {
    const blocked: BlockedDay = {
      id: "bd-1",
      restaurant_id: RESTAURANT_ID,
      date: TEST_DATE,
      reason: "Festivo",
      created_at: "",
    };
    const slots = computeAvailableSlots({ ...BASE_INPUT, blockedDays: [blocked] });
    expect(slots).toHaveLength(0);
  });

  it("returns no slots when no tables fit party size", () => {
    const slots = computeAvailableSlots({ ...BASE_INPUT, partySize: 100, tables: TABLES });
    expect(slots).toHaveLength(0);
  });

  it("shows fewer available_tables when one table is reserved", () => {
    // Use parseTimeOnDate so reservation times match the UTC-normalised slot cursors.
    const rsv = makeReservation(
      "t1",
      parseTimeOnDate(TEST_DATE, "13:30").toISOString(),
      parseTimeOnDate(TEST_DATE, "15:00").toISOString(),
    );
    const slotsNoRsv = computeAvailableSlots(BASE_INPUT);
    const slotsWithRsv = computeAvailableSlots({ ...BASE_INPUT, existingReservations: [rsv] });
    const firstSlotNoRsv = slotsNoRsv.find((s) => Math.floor(madridMins(s.starts_at) / 60) === 13);
    const firstSlotWithRsv = slotsWithRsv.find((s) => Math.floor(madridMins(s.starts_at) / 60) === 13);
    if (firstSlotNoRsv && firstSlotWithRsv) {
      expect(firstSlotWithRsv.available_tables).toBe(firstSlotNoRsv.available_tables - 1);
    }
  });

  it("returns no slots when all tables are occupied", () => {
    const table = makeTable("solo", 2);
    const rsv = makeReservation(
      "solo",
      parseTimeOnDate(TEST_DATE, "13:30").toISOString(),
      parseTimeOnDate(TEST_DATE, "15:00").toISOString(),
    );
    const slots = computeAvailableSlots({ ...BASE_INPUT, tables: [table], existingReservations: [rsv] });
    const conflictSlot = slots.find((s) => madridMins(s.starts_at) === 13 * 60 + 30);
    expect(conflictSlot).toBeUndefined();
  });

  it("does not exclude slots for cancelled reservations", () => {
    const table = makeTable("solo", 2);
    const rsv = {
      ...makeReservation(
        "solo",
        parseTimeOnDate(TEST_DATE, "13:30").toISOString(),
        parseTimeOnDate(TEST_DATE, "15:00").toISOString(),
      ),
      status: "cancelled" as const,
    };
    const slots = computeAvailableSlots({ ...BASE_INPUT, tables: [table], existingReservations: [rsv] });
    expect(slots.some((s) => Math.floor(madridMins(s.starts_at) / 60) === 13)).toBe(true);
  });

  it("does not generate slots during the lunch/dinner break", () => {
    const slots = computeAvailableSlots(BASE_INPUT);
    const inBreak = slots.find((s) => {
      const min = madridMins(s.starts_at);
      return min >= 16 * 60 && min < 20 * 60 + 30;
    });
    expect(inBreak).toBeUndefined();
  });
});

describe("isWithinBusinessHours", () => {
  it("returns true for a slot within lunch hours", () => {
    const starts = parseTimeOnDate(TEST_DATE, "13:30");
    const ends = parseTimeOnDate(TEST_DATE, "15:00");
    expect(isWithinBusinessHours(starts, ends, [TUESDAY_HOURS])).toBe(true);
  });

  it("returns true for a slot within dinner hours", () => {
    const starts = parseTimeOnDate(TEST_DATE, "20:30");
    const ends = parseTimeOnDate(TEST_DATE, "22:00");
    expect(isWithinBusinessHours(starts, ends, [TUESDAY_HOURS])).toBe(true);
  });

  it("returns false for a slot outside hours", () => {
    const starts = parseTimeOnDate(TEST_DATE, "11:00");
    const ends = parseTimeOnDate(TEST_DATE, "12:00");
    expect(isWithinBusinessHours(starts, ends, [TUESDAY_HOURS])).toBe(false);
  });

  it("returns false during the break between shifts", () => {
    const starts = parseTimeOnDate(TEST_DATE, "17:00");
    const ends = parseTimeOnDate(TEST_DATE, "18:00");
    expect(isWithinBusinessHours(starts, ends, [TUESDAY_HOURS])).toBe(false);
  });

  it("returns false when restaurant is closed", () => {
    const closed: BusinessHours = { ...TUESDAY_HOURS, is_open: false };
    const starts = parseTimeOnDate(TEST_DATE, "13:30");
    const ends = parseTimeOnDate(TEST_DATE, "15:00");
    expect(isWithinBusinessHours(starts, ends, [closed])).toBe(false);
  });
});
