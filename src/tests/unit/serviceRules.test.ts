import { describe, it, expect } from "vitest";
import {
  computeAvailableSlots,
  durationForParty,
  isWithinBusinessHours,
  parseTimeOnDate,
} from "@/lib/availability";
import type { BusinessHours, Reservation, RestaurantTable } from "@/types";

const RESTAURANT_ID = "rest-1";

function table(id: string, capacity: number, overrides: Partial<RestaurantTable> = {}): RestaurantTable {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    name: id,
    capacity,
    min_capacity: 1,
    section: "interior",
    active: true,
    sort_order: 0,
    combinable: true,
    created_at: "",
    ...overrides,
  };
}

const LUNCH: BusinessHours = {
  id: "bh",
  restaurant_id: RESTAURANT_ID,
  day_of_week: 6, // sábado — 2026-08-01
  is_open: true,
  opens_at: "13:30",
  closes_at: "16:00",
  opens_at_2: null,
  closes_at_2: null,
  max_covers_per_slot: null,
};

const DATE = "2026-08-01";
const BEFORE_SERVICE = new Date("2026-08-01T06:00:00.000Z");

const base = {
  date: DATE,
  businessHours: [LUNCH],
  blockedDays: [],
  existingReservations: [] as Reservation[],
  tables: [table("t4", 4)],
  slotIntervalMinutes: 30,
  now: BEFORE_SERVICE,
};

// ──────────────────────────────────────────────────────────────────────
// Duración según el tamaño del grupo
// ──────────────────────────────────────────────────────────────────────

describe("durationForParty", () => {
  const rules = {
    durationMinutes: 90,
    largePartyThreshold: 6,
    largePartyDurationMinutes: 150,
  };

  it("usa la duración normal por debajo del umbral", () => {
    expect(durationForParty(2, rules)).toBe(90);
    expect(durationForParty(5, rules)).toBe(90);
  });

  it("usa la duración ampliada a partir del umbral", () => {
    expect(durationForParty(6, rules)).toBe(150);
    expect(durationForParty(12, rules)).toBe(150);
  });

  it("cae a la duración normal si no hay duración de grupo grande", () => {
    expect(durationForParty(10, { durationMinutes: 90, largePartyThreshold: 6 })).toBe(90);
    expect(
      durationForParty(10, { durationMinutes: 90, largePartyThreshold: 6, largePartyDurationMinutes: 0 }),
    ).toBe(90);
  });

  it("ignora el umbral si no está configurado", () => {
    expect(durationForParty(20, { durationMinutes: 90, largePartyDurationMinutes: 150 })).toBe(90);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Última sentada
// ──────────────────────────────────────────────────────────────────────

describe("última sentada", () => {
  function lastSlotMinutes(slots: { starts_at: Date }[]): string {
    const last = slots[slots.length - 1];
    return last.starts_at.toLocaleTimeString("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  it("sin offset, la reserva debe caber entera antes del cierre", () => {
    const slots = computeAvailableSlots({ ...base, partySize: 2, durationMinutes: 90 });
    // Comida 13:30–16:00 con 90 min ⇒ última entrada a las 14:30.
    expect(lastSlotMinutes(slots)).toBe("14:30");
  });

  it("con offset de 45 min se ofrecen entradas más tardías", () => {
    const sinOffset = computeAvailableSlots({ ...base, partySize: 2, durationMinutes: 90 });
    const conOffset = computeAvailableSlots({
      ...base,
      partySize: 2,
      durationMinutes: 90,
      lastSeatingOffsetMinutes: 45,
    });
    // Última sentada = 16:00 − 45 min = 15:15. Los huecos van en rejilla de 30
    // min desde las 13:30, así que el último que cabe es el de las 15:00.
    expect(lastSlotMinutes(sinOffset)).toBe("14:30");
    expect(lastSlotMinutes(conOffset)).toBe("15:00");
    expect(conOffset.length).toBeGreaterThan(sinOffset.length);
  });

  it("el offset no adelanta la apertura del turno", () => {
    const slots = computeAvailableSlots({
      ...base,
      partySize: 2,
      durationMinutes: 90,
      lastSeatingOffsetMinutes: 45,
    });
    const first = slots[0].starts_at.toLocaleTimeString("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(first).toBe("13:30");
  });

  it("isWithinBusinessHours acepta una entrada tardía cuando hay offset", () => {
    const starts = parseTimeOnDate(DATE, "15:15");
    const ends = parseTimeOnDate(DATE, "16:45"); // se pasa del cierre
    expect(isWithinBusinessHours(starts, ends, [LUNCH])).toBe(false);
    expect(
      isWithinBusinessHours(starts, ends, [LUNCH], { lastSeatingOffsetMinutes: 45 }),
    ).toBe(true);
  });

  it("isWithinBusinessHours sigue rechazando una entrada posterior a la última sentada", () => {
    const starts = parseTimeOnDate(DATE, "15:45");
    const ends = parseTimeOnDate(DATE, "17:15");
    expect(
      isWithinBusinessHours(starts, ends, [LUNCH], { lastSeatingOffsetMinutes: 45 }),
    ).toBe(false);
  });

  it("los huecos de grupo grande usan su propia duración", () => {
    const big = computeAvailableSlots({
      ...base,
      partySize: 6,
      tables: [table("t8", 8)],
      durationMinutes: durationForParty(6, {
        durationMinutes: 90,
        largePartyThreshold: 6,
        largePartyDurationMinutes: 150,
      }),
    });
    // 13:30–16:00 con 150 min ⇒ solo cabe la entrada de las 13:30.
    expect(big).toHaveLength(1);
    expect(lastSlotMinutes(big)).toBe("13:30");
  });
});

// ──────────────────────────────────────────────────────────────────────
// Zona horaria configurable
// ──────────────────────────────────────────────────────────────────────

describe("zona horaria del restaurante", () => {
  it("interpreta el horario en la zona indicada, no siempre en Madrid", () => {
    const madrid = parseTimeOnDate(DATE, "13:30", "Europe/Madrid");
    const canarias = parseTimeOnDate(DATE, "13:30", "Atlantic/Canary");
    // Canarias va una hora por detrás de la Península.
    expect(canarias.getTime() - madrid.getTime()).toBe(3_600_000);
  });

  it("genera los huecos en la zona del restaurante", () => {
    const slots = computeAvailableSlots({
      ...base,
      partySize: 2,
      durationMinutes: 90,
      timeZone: "Atlantic/Canary",
    });
    const firstCanary = slots[0].starts_at.toLocaleTimeString("es-ES", {
      timeZone: "Atlantic/Canary",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(firstCanary).toBe("13:30");
  });
});
