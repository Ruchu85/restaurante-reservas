"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff, UNAUTHORIZED } from "@/lib/auth";
import { getRestaurantConfig, validateReservation } from "@/lib/reservationRules";
import {
  getReservationsForServiceDay,
  getReservationsForRange,
  setReservationTables,
  getReservationTableIds,
  clearReservationTables,
  attachTableIds,
  RESERVATION_SELECT,
  PUBLIC_RESERVATION_SELECT,
} from "@/lib/reservations";
import { addMinutes } from "@/lib/utils";
import { upsertGuest } from "@/lib/guests";
import { logAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rateLimit";
import { sendCancellationEmail } from "@/lib/email";
import { sendCancellationWhatsApp } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Reservation } from "@/types";

const CreateReservationSchema = z.object({
  guest_name: z.string().min(2).max(100),
  guest_phone: z.string().min(6).max(30),
  guest_email: z.string().email().nullable().optional(),
  party_size: z.number().int().min(1).max(50),
  starts_at: z.string().datetime(),
  notes: z.string().max(500).nullable().optional(),
  table_id: z.string().uuid().nullable().optional(),
  source: z.enum(["online", "phone", "admin"]).default("admin"),
  internal_notes: z.string().max(500).nullable().optional(),
  /** Saltarse el pacing: lo decide el maître, pero queda auditado. */
  override_pacing: z.boolean().optional(),
});

const UpdateReservationSchema = z.object({
  guest_name: z.string().min(2).max(100).optional(),
  guest_phone: z.string().min(6).max(30).optional(),
  guest_email: z.string().email().nullable().optional(),
  party_size: z.number().int().min(1).max(50).optional(),
  starts_at: z.string().datetime().optional(),
  notes: z.string().max(500).nullable().optional(),
  table_id: z.string().uuid().nullable().optional(),
  internal_notes: z.string().max(500).nullable().optional(),
  status: z.enum(["confirmed", "seated", "completed", "no_show", "cancelled"]).optional(),
  override_pacing: z.boolean().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;

// ─────────────────────────────────────────
// Crear
// ─────────────────────────────────────────
export async function createReservation(input: CreateReservationInput) {
  const session = await requireStaff();
  if (!session) return UNAUTHORIZED;

  const parsed = CreateReservationSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos: " + parsed.error.errors[0]?.message };

  const admin = createAdminClient();
  const restaurantId = session.restaurantId;
  const config = await getRestaurantConfig(admin, restaurantId);
  const startsAt = new Date(parsed.data.starts_at);

  const check = await validateReservation({
    admin,
    restaurantId,
    config,
    startsAt,
    partySize: parsed.data.party_size,
    tableId: parsed.data.table_id,
    overridePacing: parsed.data.override_pacing,
  });
  if (!check.ok) return { error: check.error, code: check.code };

  const guestPhone = normalizePhone(parsed.data.guest_phone);
  const guestId = await upsertGuest(admin, {
    restaurantId,
    phone: guestPhone,
    name: parsed.data.guest_name,
    email: parsed.data.guest_email ?? null,
  });

  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurantId,
      table_id: check.tables[0].id,
      guest_id: guestId,
      guest_name: parsed.data.guest_name,
      guest_phone: guestPhone,
      guest_email: parsed.data.guest_email ?? null,
      party_size: parsed.data.party_size,
      starts_at: startsAt.toISOString(),
      ends_at: check.endsAt.toISOString(),
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      source: parsed.data.source,
      status: "confirmed",
    })
    .select(RESERVATION_SELECT)
    .single();

  if (error) {
    if (error.code === "23P01") return { error: "La mesa ya está reservada para ese horario." };
    return { error: "No se pudo crear la reserva. Inténtalo de nuevo." };
  }

  const reservation = data as unknown as Reservation;
  const tableIds = check.tables.map((t) => t.id);

  // Si la asignación de mesas falla —por conflicto o por un error inesperado—
  // la reserva recién creada se borra: dejarla sin filas en `reservation_tables`
  // sacaría sus mesas de la restricción de exclusión.
  let conflict = false;
  try {
    ({ conflict } = await setReservationTables(admin, reservation, tableIds));
  } catch {
    await admin.from("reservations").delete().eq("id", reservation.id);
    return { error: "No se pudo asignar la mesa. Inténtalo de nuevo." };
  }
  if (conflict) {
    // Alguna mesa se ocupó entre el cálculo y el guardado.
    await admin.from("reservations").delete().eq("id", reservation.id);
    return { error: "Una de las mesas se acaba de ocupar. Prueba otro horario." };
  }

  await logAudit(admin, session, {
    action: "create",
    entity: "reservation",
    entityId: reservation.id,
    metadata: {
      guest_name: reservation.guest_name,
      party_size: reservation.party_size,
      starts_at: reservation.starts_at,
      tables: tableIds,
      override_pacing: parsed.data.override_pacing ?? false,
    },
  });

  revalidateDashboard();
  return { data: { ...reservation, table_ids: tableIds } };
}

// ─────────────────────────────────────────
// Actualizar
// ─────────────────────────────────────────
export async function updateReservation(id: string, input: UpdateReservationInput) {
  const session = await requireStaff();
  if (!session) return UNAUTHORIZED;

  const parsed = UpdateReservationSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos: " + parsed.error.errors[0]?.message };

  const admin = createAdminClient();
  const restaurantId = session.restaurantId;

  const { data: current } = await admin
    .from("reservations")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const existing = current as Reservation | null;
  if (!existing) return { error: "Reserva no encontrada." };

  const patch: Record<string, unknown> = {};
  for (const key of ["guest_name", "guest_email", "notes", "internal_notes", "status"] as const) {
    if (parsed.data[key] !== undefined) patch[key] = parsed.data[key];
  }
  if (parsed.data.guest_phone !== undefined) {
    patch.guest_phone = normalizePhone(parsed.data.guest_phone);
  }

  // ¿Cambia algo que afecte a la ocupación de mesa? Entonces hay que revalidar
  // TODAS las reglas, no solo el horario.
  const startsAt = parsed.data.starts_at ? new Date(parsed.data.starts_at) : new Date(existing.starts_at);
  const partySize = parsed.data.party_size ?? existing.party_size;
  const tableChanged = parsed.data.table_id !== undefined;
  const seatingChanged =
    Boolean(parsed.data.starts_at) || parsed.data.party_size !== undefined || tableChanged;

  // Cancelar o marcar no-show libera la mesa: no hay nada que revalidar.
  const releasing = patch.status === "cancelled" || patch.status === "no_show";

  let assignedTableIds: string[] | null = null;

  if (seatingChanged && !releasing) {
    const config = await getRestaurantConfig(admin, restaurantId);
    const check = await validateReservation({
      admin,
      restaurantId,
      config,
      startsAt,
      partySize,
      // `table_id: null` significa "reasignar automáticamente", nunca
      // "dejar la reserva sin mesa".
      tableId: parsed.data.table_id ?? undefined,
      excludeReservationId: id,
      overridePacing: parsed.data.override_pacing,
    });
    if (!check.ok) return { error: check.error, code: check.code };

    patch.starts_at = startsAt.toISOString();
    patch.ends_at = check.endsAt.toISOString();
    patch.party_size = partySize;
    patch.table_id = check.tables[0].id;
    assignedTableIds = check.tables.map((t) => t.id);
  } else {
    if (parsed.data.party_size !== undefined) patch.party_size = partySize;
    // Mover una reserva que a la vez se cancela no necesita validar mesa, pero
    // el cambio de hora sí debe guardarse en lugar de perderse en silencio.
    if (parsed.data.starts_at && releasing) {
      const config = await getRestaurantConfig(admin, restaurantId);
      patch.starts_at = startsAt.toISOString();
      patch.ends_at = addMinutes(startsAt, config.durationMinutes).toISOString();
    }
  }

  // Si cambia el comensal, mantener la ficha del CRM al día.
  if (patch.guest_phone || patch.guest_name) {
    patch.guest_id = await upsertGuest(admin, {
      restaurantId,
      phone: (patch.guest_phone as string) ?? existing.guest_phone,
      name: (patch.guest_name as string) ?? existing.guest_name,
      email: (patch.guest_email as string | null) ?? existing.guest_email,
    });
  }

  if (Object.keys(patch).length === 0) return { success: true };

  // Las mesas se sueltan ANTES de mover la reserva: el trigger
  // `reservations_sync_tables` arrastra las filas de `reservation_tables` al
  // nuevo horario, y si aún apuntan a la mesa antigua chocan con la
  // restricción de exclusión aunque la mesa nueva esté libre.
  let previousTableIds: string[] = [];
  if (assignedTableIds) {
    try {
      previousTableIds = await getReservationTableIds(admin, id);
      await clearReservationTables(admin, id);
    } catch {
      // Todavía no se ha tocado la reserva: se aborta sin dejar nada a medias.
      return { error: "No se pudieron liberar las mesas. Inténtalo de nuevo." };
    }
  }

  /**
   * Deja la reserva como estaba, mesas incluidas.
   * Nunca lanza: se invoca desde caminos de error y enmascarar el fallo
   * original solo complicaría el diagnóstico.
   */
  const restore = async () => {
    try {
      await admin
        .from("reservations")
        .update({
          starts_at: existing.starts_at,
          ends_at: existing.ends_at,
          table_id: existing.table_id,
          party_size: existing.party_size,
          status: existing.status,
        })
        .eq("id", id);

      if (previousTableIds.length > 0) {
        await setReservationTables(
          admin,
          {
            id,
            starts_at: existing.starts_at,
            ends_at: existing.ends_at,
            status: existing.status,
          },
          previousTableIds,
        );
      }
    } catch {
      // Si ni siquiera se puede revertir, el usuario ya recibe un error y la
      // reserva conserva su `table_id`: la exclusión de `reservations` sigue
      // protegiendo la mesa principal.
    }
  };

  const { error } = await admin
    .from("reservations")
    .update(patch)
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) {
    await restore();
    if (error.code === "23P01") return { error: "La mesa ya está reservada para ese horario." };
    return { error: "No se pudo actualizar la reserva." };
  }

  if (assignedTableIds) {
    let conflict = false;
    try {
      ({ conflict } = await setReservationTables(
        admin,
        {
          id,
          starts_at: patch.starts_at as string,
          ends_at: patch.ends_at as string,
          status: (patch.status as string) ?? existing.status,
        },
        assignedTableIds,
      ));
    } catch {
      await restore();
      return { error: "No se pudo asignar la mesa. Inténtalo de nuevo." };
    }
    if (conflict) {
      await restore();
      return { error: "Esa mesa se acaba de ocupar. Prueba otro horario." };
    }
  }

  await logAudit(admin, session, {
    action: "update",
    entity: "reservation",
    entityId: id,
    metadata: { changes: patch, tables: assignedTableIds },
  });

  revalidateDashboard();
  return { success: true };
}

export async function updateReservationStatus(id: string, status: Reservation["status"]) {
  const session = await requireStaff();
  if (!session) return UNAUTHORIZED;

  const allowed = ["confirmed", "seated", "completed", "no_show", "cancelled"] as const;
  if (!allowed.includes(status)) return { error: "Estado inválido." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .eq("restaurant_id", session.restaurantId);

  if (error) return { error: "No se pudo actualizar el estado." };

  await logAudit(admin, session, {
    action: `status:${status}`,
    entity: "reservation",
    entityId: id,
  });

  revalidateDashboard();
  return { success: true };
}

export async function cancelReservation(id: string) {
  return updateReservationStatus(id, "cancelled");
}

// ─────────────────────────────────────────
// Lecturas del dashboard (requieren sesión)
// ─────────────────────────────────────────
export async function getReservationsForDay(date: string): Promise<Reservation[]> {
  const session = await requireStaff();
  if (!session) return [];
  const admin = createAdminClient();
  return getReservationsForServiceDay(admin, session.restaurantId, date, { withRelations: true });
}

export async function getReservationsBetween(from: string, to: string): Promise<Reservation[]> {
  const session = await requireStaff();
  if (!session) return [];
  const admin = createAdminClient();
  return getReservationsForRange(admin, session.restaurantId, from, to, { withRelations: true });
}

export async function getUpcomingReservations(limit = 20): Promise<Reservation[]> {
  const session = await requireStaff();
  if (!session) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("restaurant_id", session.restaurantId)
    .in("status", ["confirmed", "seated"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(limit);

  return attachTableIds(admin, (data ?? []) as unknown as Reservation[]);
}

// ─────────────────────────────────────────
// Acceso público por token (sin sesión)
//
// Solo se exponen los campos que el propio cliente ya conoce: nunca
// `internal_notes`, que son las notas privadas del equipo de sala.
// ─────────────────────────────────────────
export async function getReservationByToken(token: string) {
  if (!z.string().uuid().safeParse(token).success) {
    return { error: "Reserva no encontrada." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select(PUBLIC_RESERVATION_SELECT)
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error || !data) return { error: "Reserva no encontrada." };
  return { data: data as unknown as Reservation };
}

export async function cancelReservationByToken(token: string) {
  if (!z.string().uuid().safeParse(token).success) {
    return { error: "Reserva no encontrada." };
  }

  // Mismo límite que el endpoint DELETE equivalente: dos caminos a la misma
  // operación deben estar protegidos igual.
  const { allowed } = rateLimit(`token-cancel:${token}`, { limit: 5, windowSeconds: 600 });
  if (!allowed) {
    return { error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." };
  }

  const admin = createAdminClient();
  const { data: reservation } = await admin
    .from("reservations")
    .select("*")
    .eq("confirmation_token", token)
    .maybeSingle();

  const r = reservation as Reservation | null;
  if (!r) return { error: "Reserva no encontrada." };
  if (r.status === "cancelled") return { error: "La reserva ya está cancelada." };

  const hoursUntil = (new Date(r.starts_at).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < 2) {
    return { error: "No se puede cancelar con menos de 2 horas de antelación. Llámanos por teléfono." };
  }

  const { error } = await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", r.id);

  if (error) return { error: "No se pudo cancelar la reserva." };

  // Este es el camino que usa de verdad la página pública, así que el aviso de
  // cancelación tiene que salir de aquí: antes solo lo mandaba el endpoint
  // DELETE equivalente, al que la UI no llama nunca.
  {
    const { data: rest } = await admin
      .from("restaurants")
      .select("name, timezone")
      .eq("id", r.restaurant_id)
      .maybeSingle();
    const restaurant = rest as { name: string; timezone: string | null } | null;

    if (r.guest_email) {
      void sendCancellationEmail({
        reservation: { ...r, status: "cancelled" },
        restaurantName: restaurant?.name ?? "Restaurante",
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
        timeZone: restaurant?.timezone ?? undefined,
      });
    }
    void sendCancellationWhatsApp({
      reservation: { ...r, status: "cancelled" },
      restaurantName: restaurant?.name ?? "Restaurante",
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
      timeZone: restaurant?.timezone ?? undefined,
    });
  }

  revalidateDashboard();
  return { success: true };
}

function revalidateDashboard() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservas");
  revalidatePath("/dashboard/calendario");
  revalidatePath("/dashboard/comensales");
}
