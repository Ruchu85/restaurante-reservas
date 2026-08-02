import { describe, it, expect } from "vitest";
import {
  assignTables,
  bestCombination,
  withinPacing,
  businessHourRanges,
  isWithinBusinessHours,
  computeAvailableSlots,
  parseTimeOnDate,
} from "@/lib/availability";
import type { BusinessHours, Reservation, RestaurantTable } from "@/types";

const RESTAURANT_ID = "rest-1";

function table(
  id: string,
  capacity: number,
  overrides: Partial<RestaurantTable> = {},
): RestaurantTable {
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

function reservation(
  tableIds: string[],
  startsAt: string,
  endsAt: string,
  overrides: Partial<Reservation> = {},
): Reservation {
  return {
    id: `r-${tableIds.join("-")}-${startsAt}`,
    restaurant_id: RESTAURANT_ID,
    table_id: tableIds[0] ?? null,
    table_ids: tableIds,
    guest_id: null,
    guest_name: "Test",
    guest_phone: "+34600000000",
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
    ...overrides,
  };
}

const START = new Date("2026-08-04T18:30:00.000Z");
const END = new Date("2026-08-04T20:00:00.000Z");

describe("assignTables — mesa individual", () => {
  it("elige la mesa más ajustada al grupo", () => {
    const tables = [table("t2", 2), table("t4", 4), table("t6", 6)];
    const assigned = assignTables(tables, [], 3, START, END);
    expect(assigned?.map((t) => t.id)).toEqual(["t4"]);
  });

  it("respeta min_capacity para no quemar una mesa grande con un grupo pequeño", () => {
    const tables = [
      table("grande", 8, { min_capacity: 5 }),
      table("mediana", 6, { min_capacity: 1 }),
    ];
    const assigned = assignTables(tables, [], 2, START, END);
    expect(assigned?.map((t) => t.id)).toEqual(["mediana"]);
  });

  it("ignora las mesas ocupadas en el tramo", () => {
    const tables = [table("t4a", 4), table("t4b", 4)];
    const busy = [reservation(["t4a"], START.toISOString(), END.toISOString())];
    const assigned = assignTables(tables, busy, 4, START, END);
    expect(assigned?.map((t) => t.id)).toEqual(["t4b"]);
  });

  it("libera la mesa de una reserva cancelada o no presentada", () => {
    const tables = [table("t4", 4)];
    for (const status of ["cancelled", "no_show"] as const) {
      const freed = [
        reservation(["t4"], START.toISOString(), END.toISOString(), { status }),
      ];
      expect(assignTables(tables, freed, 4, START, END)).not.toBeNull();
    }
  });

  it("tiene en cuenta todas las mesas de una reserva con mesas juntadas", () => {
    const tables = [table("t4a", 4), table("t4b", 4)];
    const busy = [reservation(["t4a", "t4b"], START.toISOString(), END.toISOString())];
    expect(assignTables(tables, busy, 4, START, END)).toBeNull();
  });

  it("no considera ocupada una mesa cuya reserva termina justo cuando empieza la nueva", () => {
    const tables = [table("t4", 4)];
    const previous = [
      reservation(["t4"], "2026-08-04T17:00:00.000Z", START.toISOString()),
    ];
    expect(assignTables(tables, previous, 4, START, END)).not.toBeNull();
  });
});

describe("assignTables — combinación de mesas", () => {
  it("junta mesas cuando ninguna individual da la capacidad", () => {
    const tables = [table("t4a", 4), table("t4b", 4), table("t2", 2)];
    const assigned = assignTables(tables, [], 7, START, END);
    expect(assigned).not.toBeNull();
    expect(assigned!.length).toBeGreaterThan(1);
    expect(assigned!.reduce((n, t) => n + t.capacity, 0)).toBeGreaterThanOrEqual(7);
  });

  it("prefiere menos mesas y menos plazas sobrantes", () => {
    const tables = [table("t6", 6), table("t4", 4), table("t2a", 2), table("t2b", 2)];
    const assigned = assignTables(tables, [], 10, START, END);
    expect(assigned?.map((t) => t.id).sort()).toEqual(["t4", "t6"]);
  });

  it("no junta mesas de salas distintas", () => {
    const tables = [
      table("interior", 4, { section: "interior" }),
      table("terraza", 4, { section: "terraza" }),
    ];
    expect(assignTables(tables, [], 8, START, END)).toBeNull();
  });

  it("no usa mesas marcadas como no juntables", () => {
    const tables = [table("t4a", 4, { combinable: false }), table("t4b", 4, { combinable: false })];
    expect(assignTables(tables, [], 8, START, END)).toBeNull();
  });

  it("no combina cuando la opción está desactivada", () => {
    const tables = [table("t4a", 4), table("t4b", 4)];
    expect(assignTables(tables, [], 8, START, END, false)).toBeNull();
  });

  it("bestCombination devuelve null si no se alcanza la capacidad", () => {
    expect(bestCombination([table("t2a", 2), table("t2b", 2)], 12)).toBeNull();
  });
});

describe("withinPacing", () => {
  const slotStart = new Date("2026-08-04T18:30:00.000Z");

  it("permite todo cuando no hay límite", () => {
    expect(withinPacing([], slotStart, 30, 50, null)).toBe(true);
    expect(withinPacing([], slotStart, 30, 50, 0)).toBe(true);
  });

  it("bloquea cuando la franja se llena", () => {
    const existing = [
      reservation(["t1"], slotStart.toISOString(), END.toISOString(), { party_size: 18 }),
    ];
    expect(withinPacing(existing, slotStart, 30, 4, 20)).toBe(false);
    expect(withinPacing(existing, slotStart, 30, 2, 20)).toBe(true);
  });

  it("no cuenta reservas de otra franja", () => {
    const otherSlot = [
      reservation(["t1"], "2026-08-04T19:30:00.000Z", END.toISOString(), { party_size: 30 }),
    ];
    expect(withinPacing(otherSlot, slotStart, 30, 10, 20)).toBe(true);
  });

  it("no cuenta reservas canceladas", () => {
    const cancelled = [
      reservation(["t1"], slotStart.toISOString(), END.toISOString(), {
        party_size: 30,
        status: "cancelled",
      }),
    ];
    expect(withinPacing(cancelled, slotStart, 30, 10, 20)).toBe(true);
  });
});

describe("turnos que cruzan medianoche", () => {
  const lateNight: BusinessHours = {
    id: "bh",
    restaurant_id: RESTAURANT_ID,
    day_of_week: 6, // sábado
    is_open: true,
    opens_at: "13:30",
    closes_at: "16:00",
    opens_at_2: "20:30",
    closes_at_2: "01:00",
    max_covers_per_slot: null,
  };

  it("interpreta el cierre a la 01:00 como madrugada del día siguiente", () => {
    const ranges = businessHourRanges("2026-08-01", lateNight);
    expect(ranges).toHaveLength(2);
    expect(ranges[1].close.toISOString()).toBe("2026-08-01T23:00:00.000Z"); // 01:00 del día 2
    expect(ranges[1].close.getTime()).toBeGreaterThan(ranges[1].open.getTime());
  });

  it("valida una reserva de las 23:30 del sábado que termina la 01:00", () => {
    const starts = parseTimeOnDate("2026-08-01", "23:30");
    const ends = new Date(starts.getTime() + 90 * 60000); // 01:00
    expect(isWithinBusinessHours(starts, ends, [lateNight])).toBe(true);
  });

  it("genera huecos de madrugada dentro del turno de noche", () => {
    const slots = computeAvailableSlots({
      date: "2026-08-01",
      partySize: 2,
      businessHours: [lateNight],
      existingReservations: [],
      blockedDays: [],
      tables: [table("t4", 4)],
      durationMinutes: 60,
      slotIntervalMinutes: 30,
      now: new Date("2026-08-01T06:00:00.000Z"),
    });
    // 00:00 local del día 2 = 22:00 UTC del día 1.
    expect(slots.some((s) => s.starts_at.toISOString() === "2026-08-01T22:00:00.000Z")).toBe(true);
  });
});

describe("computeAvailableSlots — pacing y combinación", () => {
  const hours: BusinessHours = {
    id: "bh",
    restaurant_id: RESTAURANT_ID,
    day_of_week: 6,
    is_open: true,
    opens_at: "20:00",
    closes_at: "23:00",
    opens_at_2: null,
    closes_at_2: null,
    max_covers_per_slot: null,
  };

  const base = {
    date: "2026-08-01",
    businessHours: [hours],
    blockedDays: [],
    existingReservations: [] as Reservation[],
    durationMinutes: 60,
    slotIntervalMinutes: 30,
    now: new Date("2026-08-01T06:00:00.000Z"),
  };

  it("oculta las franjas que superan el pacing", () => {
    const slotStart = parseTimeOnDate("2026-08-01", "20:00");
    const slots = computeAvailableSlots({
      ...base,
      partySize: 4,
      tables: [table("t4a", 4), table("t4b", 4), table("t4c", 4)],
      existingReservations: [
        reservation(["t4a"], slotStart.toISOString(), "2026-08-01T19:00:00.000Z", {
          party_size: 8,
        }),
      ],
      maxCoversPerSlot: 10,
    });
    expect(slots.some((s) => s.starts_at.getTime() === slotStart.getTime())).toBe(false);
    // Las franjas siguientes siguen disponibles.
    expect(slots.length).toBeGreaterThan(0);
  });

  it("ofrece huecos a un grupo grande solo si se pueden juntar mesas", () => {
    const tables = [table("t4a", 4), table("t4b", 4)];
    const withCombining = computeAvailableSlots({ ...base, partySize: 7, tables });
    const withoutCombining = computeAvailableSlots({
      ...base,
      partySize: 7,
      tables,
      existingReservations: [],
      allowCombining: false,
    });
    expect(withCombining.length).toBeGreaterThan(0);
    expect(withoutCombining).toHaveLength(0);
  });

  it("no ofrece horas pasadas", () => {
    const slots = computeAvailableSlots({
      ...base,
      partySize: 2,
      tables: [table("t4", 4)],
      existingReservations: [],
      now: new Date("2026-08-01T19:15:00.000Z"), // 21:15 local
    });
    expect(slots.every((s) => s.starts_at > new Date("2026-08-01T19:15:00.000Z"))).toBe(true);
  });
});
