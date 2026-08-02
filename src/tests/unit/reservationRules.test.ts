import { describe, it, expect, beforeEach } from "vitest";
import { validateReservation, type RestaurantConfig } from "@/lib/reservationRules";
import type { BusinessHours, BlockedDay, Reservation, RestaurantTable } from "@/types";

/**
 * `validateReservation` es la puerta única de las reglas de negocio, así que se
 * prueba con un doble del cliente de Supabase: sin esto, un fallo aquí llega a
 * producción con los 100 tests en verde (que es justo lo que pasó con la mesa
 * elegida a mano).
 */

const RESTAURANT_ID = "rest-1";

const HOURS: BusinessHours[] = [
  {
    id: "bh-sat",
    restaurant_id: RESTAURANT_ID,
    day_of_week: 6, // sábado
    is_open: true,
    opens_at: "13:30",
    closes_at: "16:00",
    opens_at_2: "20:30",
    closes_at_2: "01:00", // cruza medianoche
    max_covers_per_slot: null,
  },
  {
    id: "bh-sun",
    restaurant_id: RESTAURANT_ID,
    day_of_week: 0, // domingo
    is_open: true,
    opens_at: "13:30",
    closes_at: "16:00",
    opens_at_2: null,
    closes_at_2: null,
    max_covers_per_slot: null,
  },
];

function table(id: string, capacity: number, over: Partial<RestaurantTable> = {}): RestaurantTable {
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
    ...over,
  };
}

function reservation(
  id: string,
  tableIds: string[],
  startsAt: string,
  endsAt: string,
  over: Partial<Reservation> = {},
): Reservation {
  return {
    id,
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
    ...over,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Doble mínimo del cliente admin de Supabase
// ──────────────────────────────────────────────────────────────────────

interface FakeState {
  tables: RestaurantTable[];
  reservations: Reservation[];
  blockedDays: BlockedDay[];
  businessHours: BusinessHours[];
}

let state: FakeState;

/**
 * Doble del builder de Supabase: encadena como el real y recuerda los filtros
 * `.eq()`, que es lo que necesita `blocked_days` para responder por fecha.
 */
function makeAdmin() {
  function from(tableName: string) {
    const filters: Record<string, unknown> = {};

    const rows = (): unknown[] => {
      switch (tableName) {
        case "restaurant_tables":
          return state.tables.filter((t) => t.active);
        case "business_hours":
          return state.businessHours;
        case "reservations":
          return state.reservations;
        case "blocked_days":
          return state.blockedDays.filter(
            (d) => filters.date === undefined || d.date === filters.date,
          );
        default:
          return [];
      }
    };

    const builder = {
      select: () => builder,
      order: () => builder,
      gte: () => builder,
      lte: () => builder,
      lt: () => builder,
      gt: () => builder,
      in: () => builder,
      limit: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (onFulfilled: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(onFulfilled),
    };

    return builder;
  }

  return { from } as never;
}

const CONFIG: RestaurantConfig = {
  durationMinutes: 90,
  maxCoversPerSlot: null,
  allowTableCombination: true,
  maxPartySize: 10,
  lastSeatingOffsetMinutes: 0,
  largePartyThreshold: 6,
  largePartyDurationMinutes: null,
  blockOnlineAfterNoShows: null,
  minAdvanceHours: 1,
  maxAdvanceDays: 30,
  timezone: "Europe/Madrid",
  name: "Demo",
  phone: null,
};

// 2026-08-01 es sábado. 13:30 Madrid = 11:30Z; 21:00 Madrid = 19:00Z.
const LUNCH = new Date("2026-08-01T11:30:00.000Z");
const DINNER = new Date("2026-08-01T19:00:00.000Z");

async function validate(over: Partial<Parameters<typeof validateReservation>[0]> = {}) {
  return validateReservation({
    admin: makeAdmin(),
    restaurantId: RESTAURANT_ID,
    config: CONFIG,
    startsAt: DINNER,
    partySize: 2,
    ...over,
  });
}

beforeEach(() => {
  state = {
    tables: [table("t2", 2), table("t4", 4), table("t6", 6)],
    reservations: [],
    blockedDays: [],
    businessHours: HOURS,
  };
});

describe("validateReservation — mesa elegida a mano", () => {
  it("acepta una mesa libre", async () => {
    const result = await validate({ tableId: "t4" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tables.map((t) => t.id)).toEqual(["t4"]);
  });

  it("NO da por ocupada una mesa que solo tuvo reserva en otro turno", async () => {
    // Regresión: se comparaban solo los ids de mesa, sin mirar horarios, y la
    // ventana de búsqueda es de ±12 h. Una comida a las 13:30 bloqueaba la
    // cena de las 21:00 en la misma mesa.
    state.reservations = [
      reservation("r-lunch", ["t4"], LUNCH.toISOString(), "2026-08-01T13:00:00.000Z"),
    ];
    const result = await validate({ tableId: "t4" });
    expect(result.ok).toBe(true);
  });

  it("rechaza una mesa realmente ocupada en ese tramo", async () => {
    state.reservations = [
      reservation("r-dinner", ["t4"], DINNER.toISOString(), "2026-08-01T20:30:00.000Z"),
    ];
    const result = await validate({ tableId: "t4" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_TABLES");
  });

  it("rechaza una mesa de otro restaurante", async () => {
    // No está en `tables` porque `getActiveTables` filtra por restaurante.
    const result = await validate({ tableId: "mesa-de-otro-tenant" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no existe|no está activa/i);
  });

  it("rechaza una mesa demasiado pequeña para el grupo", async () => {
    const result = await validate({ tableId: "t2", partySize: 6 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/admite 2 comensales/);
  });

  it("ignora la reserva que se está editando al comprobar su propia mesa", async () => {
    state.reservations = [
      reservation("r-self", ["t4"], DINNER.toISOString(), "2026-08-01T20:30:00.000Z"),
    ];
    const result = await validate({ tableId: "t4", excludeReservationId: "r-self" });
    expect(result.ok).toBe(true);
  });
});

describe("validateReservation — asignación automática", () => {
  it("elige la mesa más ajustada", async () => {
    const result = await validate({ partySize: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tables.map((t) => t.id)).toEqual(["t4"]);
  });

  it("junta mesas para un grupo que no cabe en ninguna", async () => {
    const result = await validate({ partySize: 9 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tables.length).toBeGreaterThan(1);
  });

  it("reasigna la combinación al editar una reserva de mesas juntadas", async () => {
    // El diálogo de edición manda `table_id: null` para las reservas con varias
    // mesas (precargar solo la primera las rechazaba por capacidad), así que la
    // combinación se recalcula excluyendo la propia reserva.
    state.reservations = [
      reservation("r-grupo", ["t6", "t4"], DINNER.toISOString(), "2026-08-01T20:30:00.000Z", {
        party_size: 9,
      }),
    ];

    const sinExcluir = await validate({ partySize: 9 });
    expect(sinExcluir.ok).toBe(false); // sus propias mesas la bloquean

    const editando = await validate({ partySize: 9, excludeReservationId: "r-grupo" });
    expect(editando.ok).toBe(true);
    if (editando.ok) {
      expect(editando.tables.reduce((n, t) => n + t.capacity, 0)).toBeGreaterThanOrEqual(9);
    }
  });

  it("falla si no queda sitio", async () => {
    state.reservations = state.tables.map((t, i) =>
      reservation(`r-${i}`, [t.id], DINNER.toISOString(), "2026-08-01T20:30:00.000Z"),
    );
    const result = await validate({ partySize: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_TABLES");
  });
});

describe("validateReservation — reglas de negocio", () => {
  it("rechaza un grupo mayor que el máximo del restaurante", async () => {
    const result = await validate({ partySize: 40 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PARTY_SIZE");
  });

  it("rechaza una hora fuera del horario", async () => {
    const result = await validate({ startsAt: new Date("2026-08-01T05:00:00.000Z") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("HOURS");
  });

  it("rechaza un día bloqueado", async () => {
    state.blockedDays = [
      { id: "b1", restaurant_id: RESTAURANT_ID, date: "2026-08-01", reason: null, created_at: "" },
    ];
    const result = await validate();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLOSED");
  });

  it("aplica el pacing y permite forzarlo", async () => {
    state.reservations = [
      reservation("r-big", ["t6"], DINNER.toISOString(), "2026-08-01T20:30:00.000Z", {
        party_size: 8,
      }),
    ];
    const config = { ...CONFIG, maxCoversPerSlot: 10 };

    const blocked = await validate({ config, partySize: 4 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("PACING");

    const forced = await validate({ config, partySize: 4, overridePacing: true });
    expect(forced.ok).toBe(true);
  });

  it("usa la duración de grupo grande para calcular el fin", async () => {
    const config = { ...CONFIG, largePartyThreshold: 6, largePartyDurationMinutes: 150 };
    const result = await validate({ config, partySize: 6 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const minutes = (result.endsAt.getTime() - DINNER.getTime()) / 60000;
      expect(minutes).toBe(150);
    }
  });
});

describe("validateReservation — día de servicio", () => {
  it("una reserva de las 23:30 del sábado pertenece al sábado", async () => {
    // 23:30 Madrid = 21:30Z. Termina a la 01:00, justo al cierre del turno.
    const result = await validate({ startsAt: new Date("2026-08-01T21:30:00.000Z") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.serviceDate).toBe("2026-08-01");
  });

  it("asigna una reserva de madrugada al servicio de la noche anterior", async () => {
    // 00:30 del domingo = 22:30Z del sábado. Con última sentada a la 00:30 la
    // entrada se acepta aunque la sobremesa pase del cierre.
    const config = { ...CONFIG, lastSeatingOffsetMinutes: 30 };
    const result = await validate({
      config,
      startsAt: new Date("2026-08-01T22:30:00.000Z"),
    });
    expect(result.ok).toBe(true);
    // El domingo abre a las 13:30: si se resolviera por el reloj, este hueco
    // caería en domingo y se le aplicaría el pacing y los cierres equivocados.
    if (result.ok) expect(result.serviceDate).toBe("2026-08-01");
  });

  it("cerrar el domingo no cancela la cola de la cena del sábado", async () => {
    state.blockedDays = [
      { id: "b1", restaurant_id: RESTAURANT_ID, date: "2026-08-02", reason: null, created_at: "" },
    ];
    const config = { ...CONFIG, lastSeatingOffsetMinutes: 30 };
    const result = await validate({
      config,
      startsAt: new Date("2026-08-01T22:30:00.000Z"),
    });
    // Se acepta: el día de servicio es el sábado, que no está bloqueado.
    expect(result.ok).toBe(true);
  });

  it("cerrar el sábado sí cancela la cola de su propia cena", async () => {
    state.blockedDays = [
      { id: "b1", restaurant_id: RESTAURANT_ID, date: "2026-08-01", reason: null, created_at: "" },
    ];
    const config = { ...CONFIG, lastSeatingOffsetMinutes: 30 };
    const result = await validate({
      config,
      startsAt: new Date("2026-08-01T22:30:00.000Z"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLOSED");
  });

  it("una comida del domingo pertenece al domingo", async () => {
    // 13:30 del domingo 2 de agosto = 11:30Z.
    const result = await validate({ startsAt: new Date("2026-08-02T11:30:00.000Z") });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.serviceDate).toBe("2026-08-02");
  });
});
