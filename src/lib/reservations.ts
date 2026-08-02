import { createAdminClient } from "@/lib/supabase/admin";
import { madridDayRangeUtc, madridRangeUtc } from "@/lib/dates";
import type { Reservation } from "@/types";

type Admin = ReturnType<typeof createAdminClient>;

export const RESERVATION_SELECT =
  "*, table:restaurant_tables(id, name, capacity, section), guest:guests(id, visits_count, no_shows_count, tags, allergies, notes)";

/**
 * Campos visibles para el cliente en la página pública de su reserva.
 *
 * Lista blanca a propósito: con `select("*")` se filtraban `internal_notes`
 * —las notas privadas del equipo de sala, del tipo "no darle la terraza"— al
 * payload de una página que ve el propio cliente.
 *
 * Sí se incluyen nombre, teléfono y email porque son los datos que el cliente
 * escribió al reservar y que espera poder revisar aquí.
 */
export const PUBLIC_RESERVATION_SELECT =
  "id, guest_name, guest_phone, guest_email, party_size, starts_at, ends_at, status, " +
  "notes, confirmation_token, table:restaurant_tables(name, section)";

/**
 * Rellena `table_ids` con todas las mesas asignadas a cada reserva.
 * Las reservas de una sola mesa quedan con `[table_id]`.
 */
export async function attachTableIds(
  admin: Admin,
  reservations: Reservation[],
): Promise<Reservation[]> {
  if (reservations.length === 0) return reservations;

  const ids = reservations.map((r) => r.id);
  const { data } = await admin
    .from("reservation_tables")
    .select("reservation_id, table_id")
    .in("reservation_id", ids);

  const byReservation = new Map<string, string[]>();
  for (const row of (data ?? []) as { reservation_id: string; table_id: string }[]) {
    const list = byReservation.get(row.reservation_id) ?? [];
    list.push(row.table_id);
    byReservation.set(row.reservation_id, list);
  }

  return reservations.map((r) => ({
    ...r,
    table_ids: byReservation.get(r.id) ?? (r.table_id ? [r.table_id] : []),
  }));
}

/**
 * Reservas de un día natural del restaurante (Europe/Madrid).
 *
 * Usa la ventana UTC real del día local: una reserva de las 00:30 pertenece al
 * servicio de la noche anterior y debe entrar en el cálculo de solapamientos.
 */
export async function getReservationsForServiceDay(
  admin: Admin,
  restaurantId: string,
  date: string,
  opts: { withRelations?: boolean; timeZone?: string } = {},
): Promise<Reservation[]> {
  const { from, to } = madridDayRangeUtc(date, opts.timeZone);
  const { data } = await admin
    .from("reservations")
    .select(opts.withRelations ? RESERVATION_SELECT : "*")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");

  return attachTableIds(admin, (data ?? []) as unknown as Reservation[]);
}

/**
 * Reservas que pueden solapar con el tramo [startsAt, endsAt).
 *
 * No basta con el día natural: una reserva que empieza a las 23:30 del día
 * anterior sigue ocupando mesa a las 00:30. Se amplía la ventana un día por
 * cada lado y se filtra por solapamiento real.
 */
export async function getOverlappingReservations(
  admin: Admin,
  restaurantId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<Reservation[]> {
  // 12 h de margen cubre de sobra cualquier duración de servicio razonable.
  const marginMs = 12 * 60 * 60 * 1000;
  const from = new Date(startsAt.getTime() - marginMs).toISOString();
  const to = new Date(endsAt.getTime() + marginMs).toISOString();

  const { data } = await admin
    .from("reservations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", from)
    .lte("starts_at", to);

  return attachTableIds(admin, (data ?? []) as Reservation[]);
}

/** Reservas de un rango inclusivo de días naturales del restaurante. */
export async function getReservationsForRange(
  admin: Admin,
  restaurantId: string,
  fromDate: string,
  toDate: string,
  opts: { withRelations?: boolean; timeZone?: string } = {},
): Promise<Reservation[]> {
  const { from, to } = madridRangeUtc(fromDate, toDate, opts.timeZone);
  const { data } = await admin
    .from("reservations")
    .select(opts.withRelations ? RESERVATION_SELECT : "*")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");

  return attachTableIds(admin, (data ?? []) as unknown as Reservation[]);
}

/**
 * Registra las mesas asignadas a una reserva y deja que la base de datos
 * garantice que ninguna queda doblemente reservada.
 *
 * Devuelve `{ conflict: true }` si alguna mesa ya estaba ocupada (23P01).
 */
export async function setReservationTables(
  admin: Admin,
  reservation: { id: string; starts_at: string; ends_at: string; status: string },
  tableIds: string[],
): Promise<{ conflict: boolean }> {
  await clearReservationTables(admin, reservation.id);

  if (tableIds.length === 0) return { conflict: false };

  const { error } = await admin.from("reservation_tables").insert(
    tableIds.map((table_id) => ({
      reservation_id: reservation.id,
      table_id,
      starts_at: reservation.starts_at,
      ends_at: reservation.ends_at,
      status: reservation.status,
    })),
  );

  if (!error) return { conflict: false };
  // 23P01 = la mesa se ocupó entretanto; es un caso de negocio esperado.
  if (error.code === "23P01") return { conflict: true };

  // Cualquier otro error se propaga: tragárselo dejaba la reserva sin filas en
  // `reservation_tables`, y con ello sus mesas juntadas fuera de la restricción
  // de exclusión, que es justo la garantía de "una mesa, una reserva".
  throw new Error(`No se pudieron asignar las mesas de la reserva: ${error.code}`);
}

/** Mesas actualmente asignadas a una reserva. */
export async function getReservationTableIds(
  admin: Admin,
  reservationId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("reservation_tables")
    .select("table_id")
    .eq("reservation_id", reservationId);
  return ((data ?? []) as { table_id: string }[]).map((r) => r.table_id);
}

/**
 * Suelta las mesas de una reserva.
 *
 * Hay que hacerlo ANTES de mover la reserva de hora: el trigger
 * `reservations_sync_tables` arrastra las filas de `reservation_tables` al
 * nuevo horario, y si todavía apuntan a la mesa antigua chocan con la
 * restricción de exclusión aunque la mesa nueva esté libre.
 */
export async function clearReservationTables(
  admin: Admin,
  reservationId: string,
): Promise<void> {
  const { error } = await admin
    .from("reservation_tables")
    .delete()
    .eq("reservation_id", reservationId);
  if (error) {
    throw new Error(`No se pudieron liberar las mesas de la reserva: ${error.code}`);
  }
}
