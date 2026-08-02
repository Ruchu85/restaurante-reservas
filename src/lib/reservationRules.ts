import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessHours, getActiveTables } from "@/lib/restaurant";
import {
  assignTables,
  isWithinBusinessHours,
  withinPacing,
  durationForParty,
  freeTables,
  resolveServiceDate,
} from "@/lib/availability";
import { getOverlappingReservations } from "@/lib/reservations";
import { addMinutes } from "@/lib/utils";
import { dayOfWeek } from "@/lib/dates";
import type { RestaurantTable, ServiceRules } from "@/types";

type Admin = ReturnType<typeof createAdminClient>;

export const RULES_COLUMNS =
  "reservation_duration_minutes, max_covers_per_slot, allow_table_combination, " +
  "max_party_size, last_seating_offset_minutes, large_party_threshold, " +
  "large_party_duration_minutes, block_online_after_no_shows, timezone, " +
  "min_advance_hours, max_advance_days, name, phone";

export interface RestaurantConfig extends ServiceRules {
  minAdvanceHours: number;
  maxAdvanceDays: number;
  blockOnlineAfterNoShows: number | null;
  name: string;
  phone: string | null;
}

/** Lee la configuración de servicio del restaurante con valores por defecto sensatos. */
export async function getRestaurantConfig(
  admin: Admin,
  restaurantId: string,
): Promise<RestaurantConfig> {
  const { data } = await admin
    .from("restaurants")
    .select(RULES_COLUMNS)
    .eq("id", restaurantId)
    .maybeSingle();

  const r = (data ?? {}) as Record<string, unknown>;
  const num = (key: string, fallback: number) =>
    typeof r[key] === "number" ? (r[key] as number) : fallback;

  return {
    durationMinutes: num("reservation_duration_minutes", 90),
    maxCoversPerSlot: typeof r.max_covers_per_slot === "number" ? r.max_covers_per_slot : null,
    allowTableCombination: r.allow_table_combination !== false,
    maxPartySize: num("max_party_size", 10),
    lastSeatingOffsetMinutes: num("last_seating_offset_minutes", 0),
    largePartyThreshold: num("large_party_threshold", 6),
    largePartyDurationMinutes:
      typeof r.large_party_duration_minutes === "number" ? r.large_party_duration_minutes : null,
    blockOnlineAfterNoShows:
      typeof r.block_online_after_no_shows === "number" ? r.block_online_after_no_shows : null,
    minAdvanceHours: num("min_advance_hours", 1),
    maxAdvanceDays: num("max_advance_days", 30),
    timezone: typeof r.timezone === "string" && r.timezone ? r.timezone : "Europe/Madrid",
    name: typeof r.name === "string" ? r.name : "Restaurante",
    phone: typeof r.phone === "string" ? r.phone : null,
  };
}

export interface ValidateInput {
  admin: Admin;
  restaurantId: string;
  config: RestaurantConfig;
  startsAt: Date;
  partySize: number;
  /** Mesa elegida a mano. `null`/`undefined` = asignación automática. */
  tableId?: string | null;
  /** Reserva que se está editando: sus mesas no deben contar como ocupadas. */
  excludeReservationId?: string;
  /** El maître puede saltarse el pacing; queda auditado. */
  overridePacing?: boolean;
}

export type ValidationResult =
  | { ok: false; error: string; code?: "PACING" | "NO_TABLES" | "CLOSED" | "HOURS" | "PARTY_SIZE" }
  | { ok: true; endsAt: Date; tables: RestaurantTable[]; serviceDate: string };

/**
 * Única puerta de entrada a las reglas de negocio de una reserva.
 *
 * Antes vivían duplicadas en `createReservation` y en el endpoint público, y
 * `updateReservation` solo comprobaba el horario: se podía mover una reserva a
 * un día cerrado, saltarse el pacing o dejar a doce personas en una mesa de dos.
 */
export async function validateReservation(input: ValidateInput): Promise<ValidationResult> {
  const {
    admin,
    restaurantId,
    config,
    startsAt,
    partySize,
    tableId,
    excludeReservationId,
    overridePacing = false,
  } = input;

  if (partySize > config.maxPartySize) {
    return {
      ok: false,
      code: "PARTY_SIZE",
      error: `El grupo máximo por reserva es de ${config.maxPartySize} comensales.`,
    };
  }

  const duration = durationForParty(partySize, {
    durationMinutes: config.durationMinutes,
    largePartyThreshold: config.largePartyThreshold,
    largePartyDurationMinutes: config.largePartyDurationMinutes,
  });
  const endsAt = addMinutes(startsAt, duration);

  // Horario
  const businessHours = await getBusinessHours(admin, restaurantId);
  const withinHours = isWithinBusinessHours(startsAt, endsAt, businessHours, {
    lastSeatingOffsetMinutes: config.lastSeatingOffsetMinutes,
    timeZone: config.timezone,
  });
  if (!withinHours) {
    return {
      ok: false,
      code: "HOURS",
      error: "La hora seleccionada está fuera del horario del restaurante.",
    };
  }

  // Día de servicio: el del TURNO al que pertenece la reserva, no el del reloj.
  // Una reserva de las 00:30 del domingo es la cola de la cena del sábado, así
  // que cerrar el domingo no debe cancelarla, y el pacing que le toca es el del
  // sábado.
  // `withinHours` ya garantiza que hay un turno que lo contiene.
  const serviceDate = resolveServiceDate(startsAt, endsAt, businessHours, {
    lastSeatingOffsetMinutes: config.lastSeatingOffsetMinutes,
    timeZone: config.timezone,
  })!;

  // Día cerrado
  const { data: blocked } = await admin
    .from("blocked_days")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("date", serviceDate)
    .maybeSingle();
  if (blocked) {
    return { ok: false, code: "CLOSED", error: "El restaurante está cerrado ese día." };
  }

  const [tables, overlappingRaw] = await Promise.all([
    getActiveTables(admin, restaurantId),
    getOverlappingReservations(admin, restaurantId, startsAt, endsAt),
  ]);

  // Al editar, la propia reserva no compite consigo misma por la mesa.
  const overlapping = excludeReservationId
    ? overlappingRaw.filter((r) => r.id !== excludeReservationId)
    : overlappingRaw;

  // Pacing
  if (!overridePacing) {
    const dayHours = businessHours.find((h) => h.day_of_week === dayOfWeek(serviceDate));
    const pacing = dayHours?.max_covers_per_slot ?? config.maxCoversPerSlot;
    if (!withinPacing(overlapping, startsAt, 30, partySize, pacing)) {
      return {
        ok: false,
        code: "PACING",
        error: `Se supera el máximo de ${pacing} comensales en esa franja. Elige otra hora o fuerza la reserva.`,
      };
    }
  }

  // Mesa elegida a mano: debe existir, estar activa, ser de ESTE restaurante,
  // caber el grupo y estar libre EN ESE TRAMO.
  if (tableId) {
    const chosen = tables.find((t) => t.id === tableId);
    if (!chosen) {
      return { ok: false, code: "NO_TABLES", error: "La mesa seleccionada no existe o no está activa." };
    }
    if (chosen.capacity < partySize) {
      return {
        ok: false,
        code: "NO_TABLES",
        error: `${chosen.name} admite ${chosen.capacity} comensales; el grupo es de ${partySize}.`,
      };
    }
    // `overlapping` trae una ventana amplia (±12 h) alrededor del tramo, así que
    // hay que comparar horarios de verdad: comprobar solo el id de mesa daba
    // "ocupada" a una cena porque esa misma mesa tuvo una comida ese día.
    const free = freeTables(tables, overlapping, startsAt, endsAt);
    if (!free.some((t) => t.id === chosen.id)) {
      return { ok: false, code: "NO_TABLES", error: `${chosen.name} ya está ocupada en ese horario.` };
    }
    return { ok: true, endsAt, tables: [chosen], serviceDate };
  }

  // Asignación automática
  const assigned = assignTables(
    tables,
    overlapping,
    partySize,
    startsAt,
    endsAt,
    config.allowTableCombination,
  );
  if (!assigned) {
    return {
      ok: false,
      code: "NO_TABLES",
      error: "No hay mesas disponibles para esa hora y número de personas.",
    };
  }

  return { ok: true, endsAt, tables: assigned, serviceDate };
}
