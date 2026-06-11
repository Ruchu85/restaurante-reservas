import { describe, it, expect } from "vitest";
import { computeAvailableSlots, isWithinBusinessHours, peakConcurrency } from "@/lib/availability";
import type { BusinessHours, Appointment, BlockedDay } from "@/types";

const SALON_ID = "salon-1";
const STAFF_ID = "staff-1";

// Un lunes futuro dinámico: computeAvailableSlots descarta horas pasadas,
// así que el test debe situarse en el futuro para ser determinista.
function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const TEST_DATE = nextMonday();

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
    price: null,
    status: "active",
    ticket_printed: false,
    ticket_number: null,
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

describe("computeAvailableSlots · capacidad multi-cliente", () => {
  it("con capacidad 2, un solo solapamiento NO bloquea el tramo", () => {
    const appt = makeAppt(`${TEST_DATE}T10:00:00`, `${TEST_DATE}T11:00:00`);
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [appt],
      blockedDays: [],
      capacity: 2,
    });
    const slot = slots.find((s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0);
    expect(slot).toBeDefined();
    expect(slot?.remaining).toBe(1);
  });

  it("con capacidad 2, dos solapamientos SÍ bloquean el tramo", () => {
    const a = makeAppt(`${TEST_DATE}T10:00:00`, `${TEST_DATE}T11:00:00`);
    const b = makeAppt(`${TEST_DATE}T10:00:00`, `${TEST_DATE}T11:00:00`);
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [a, b],
      blockedDays: [],
      capacity: 2,
    });
    const slot = slots.find((s) => s.starts_at.getHours() === 10 && s.starts_at.getMinutes() === 0);
    expect(slot).toBeUndefined();
  });

  it("expone los huecos restantes en tramos libres", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      businessHours: [MONDAY_HOURS],
      existingAppointments: [],
      blockedDays: [],
      capacity: 3,
    });
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((s) => expect(s.remaining).toBe(3));
  });
});

describe("computeAvailableSlots · turno partido", () => {
  const SPLIT_HOURS: BusinessHours = {
    ...MONDAY_HOURS,
    opens_at: "09:00",
    closes_at: "14:00",
    opens_at_2: "16:00",
    closes_at_2: "20:00",
  };

  it("no genera huecos en la pausa del mediodía", () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 30,
      businessHours: [SPLIT_HOURS],
      existingAppointments: [],
      blockedDays: [],
    });
    const inBreak = slots.find((s) => {
      const min = s.starts_at.getHours() * 60 + s.starts_at.getMinutes();
      return min >= 14 * 60 && min < 16 * 60;
    });
    expect(inBreak).toBeUndefined();
    // sí hay huecos en ambos tramos
    expect(slots.some((s) => s.starts_at.getHours() < 14)).toBe(true);
    expect(slots.some((s) => s.starts_at.getHours() >= 16)).toBe(true);
  });
});

describe("peakConcurrency", () => {
  const D = "2026-06-01";

  it("cuenta la concurrencia máxima de citas solapadas", () => {
    const a = makeAppt(`${D}T10:00:00`, `${D}T11:00:00`);
    const b = makeAppt(`${D}T10:00:00`, `${D}T11:00:00`);
    const peak = peakConcurrency([a, b], new Date(`${D}T10:00:00`), new Date(`${D}T11:00:00`));
    expect(peak).toBe(2);
  });

  it("no sobreestima con servicios largos (evita falsos completos)", () => {
    // Mechas 10:00–12:00 y corte 11:00–11:30. Para una nueva cita 10:00–10:30
    // a las 10:00 solo está la de mechas → pico 1 (no 2).
    const mechas = makeAppt(`${D}T10:00:00`, `${D}T12:00:00`);
    const corte = makeAppt(`${D}T11:00:00`, `${D}T11:30:00`);
    const peak = peakConcurrency([mechas, corte], new Date(`${D}T10:00:00`), new Date(`${D}T10:30:00`));
    expect(peak).toBe(1);
  });

  it("excluye la propia cita al editar", () => {
    const self = makeAppt(`${D}T10:00:00`, `${D}T11:00:00`);
    const peak = peakConcurrency([self], new Date(`${D}T10:00:00`), new Date(`${D}T11:00:00`), self.id);
    expect(peak).toBe(0);
  });

  it("ignora citas canceladas", () => {
    const cancelled = { ...makeAppt(`${D}T10:00:00`, `${D}T11:00:00`), status: "cancelled" as const };
    const peak = peakConcurrency([cancelled], new Date(`${D}T10:00:00`), new Date(`${D}T11:00:00`));
    expect(peak).toBe(0);
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
