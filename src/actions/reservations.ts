"use server";

import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import {
  getBusinessHours,
  getActiveTables,
} from "@/lib/restaurant";
import { findBestTable, isWithinBusinessHours } from "@/lib/availability";
import { revalidatePath } from "next/cache";
import { addMinutes } from "@/lib/utils";
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
});

const UpdateReservationSchema = CreateReservationSchema.partial().extend({
  status: z
    .enum(["confirmed", "seated", "completed", "no_show", "cancelled"])
    .optional(),
  internal_notes: z.string().max(500).nullable().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;

export async function createReservation(input: CreateReservationInput) {
  const parsed = CreateReservationSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos: " + parsed.error.message };

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { error: "Restaurante no encontrado." };

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("reservation_duration_minutes")
    .eq("id", restaurantId)
    .single();

  const durationMinutes = (restaurant as { reservation_duration_minutes: number } | null)
    ?.reservation_duration_minutes ?? 90;

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = addMinutes(startsAt, durationMinutes);

  // Check blocked day
  const dateStr = parsed.data.starts_at.substring(0, 10);
  const { data: blocked } = await admin
    .from("blocked_days")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("date", dateStr)
    .maybeSingle();

  if (blocked) return { error: "El restaurante está cerrado ese día." };

  // Check business hours
  const businessHours = await getBusinessHours(restaurantId);
  if (!isWithinBusinessHours(startsAt, endsAt, businessHours)) {
    return { error: "La hora seleccionada está fuera del horario del restaurante." };
  }

  // Auto-assign table if not provided
  let tableId = parsed.data.table_id ?? null;
  if (!tableId) {
    const [tables, existing] = await Promise.all([
      getActiveTables(restaurantId),
      getReservationsForDate(admin, restaurantId, dateStr),
    ]);

    const best = findBestTable(
      tables,
      existing,
      parsed.data.party_size,
      startsAt,
      endsAt,
    );
    if (!best) {
      return { error: "No hay mesas disponibles para esa hora y número de personas." };
    }
    tableId = best.id;
  }

  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      guest_name: parsed.data.guest_name,
      guest_phone: parsed.data.guest_phone,
      guest_email: parsed.data.guest_email ?? null,
      party_size: parsed.data.party_size,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      notes: parsed.data.notes ?? null,
      internal_notes: parsed.data.internal_notes ?? null,
      source: parsed.data.source,
      status: "confirmed",
    })
    .select("*, table:restaurant_tables(id, name, capacity, section)")
    .single();

  if (error) {
    if (error.code === "23P01") {
      return { error: "La mesa ya está reservada para ese horario." };
    }
    return { error: "No se pudo crear la reserva. Inténtalo de nuevo." };
  }

  revalidatePath("/dashboard/reservas");
  revalidatePath("/dashboard/calendario");
  revalidatePath("/dashboard");
  return { data: data as Reservation };
}

export async function updateReservation(id: string, input: UpdateReservationInput) {
  const parsed = UpdateReservationSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("reservations")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    if (error.code === "23P01") {
      return { error: "La mesa ya está reservada para ese horario." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/reservas");
  revalidatePath("/dashboard/calendario");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateReservationStatus(
  id: string,
  status: Reservation["status"],
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("reservations")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/reservas");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function cancelReservation(id: string) {
  return updateReservationStatus(id, "cancelled");
}

export async function getReservationByToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, section)")
    .eq("confirmation_token", token)
    .single();

  if (error) return { error: "Reserva no encontrada." };
  return { data: data as Reservation };
}

export async function cancelReservationByToken(token: string) {
  const admin = createAdminClient();
  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, starts_at")
    .eq("confirmation_token", token)
    .single();

  if (!reservation) return { error: "Reserva no encontrada." };
  if (reservation.status === "cancelled") return { error: "La reserva ya está cancelada." };

  // Only allow cancellation if it's more than 2 hours before
  const startsAt = new Date(reservation.starts_at);
  const now = new Date();
  const hoursUntil = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil < 2) {
    return { error: "No se puede cancelar con menos de 2 horas de antelación." };
  }

  const { error } = await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("confirmation_token", token);

  if (error) return { error: error.message };
  return { success: true };
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
async function getReservationsForDate(
  admin: ReturnType<typeof createAdminClient>,
  restaurantId: string,
  date: string,
): Promise<Reservation[]> {
  const { data } = await admin
    .from("reservations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", date + "T00:00:00.000Z")
    .lte("starts_at", date + "T23:59:59.999Z");
  return (data ?? []) as Reservation[];
}

export async function getReservationsForDay(date: string): Promise<Reservation[]> {
  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();

  const { data } = await admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, capacity, section)")
    .eq("restaurant_id", restaurantId ?? "")
    .gte("starts_at", date + "T00:00:00.000Z")
    .lte("starts_at", date + "T23:59:59.999Z")
    .order("starts_at");

  return (data ?? []) as Reservation[];
}

export async function getUpcomingReservations(limit = 20): Promise<Reservation[]> {
  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  const now = new Date().toISOString();

  const { data } = await admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, capacity, section)")
    .eq("restaurant_id", restaurantId ?? "")
    .in("status", ["confirmed", "seated"])
    .gte("starts_at", now)
    .order("starts_at")
    .limit(limit);

  return (data ?? []) as Reservation[];
}
