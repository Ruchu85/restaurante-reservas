"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff, UNAUTHORIZED } from "@/lib/auth";
import { searchGuests as searchGuestsLib, countGuests } from "@/lib/guests";
import { attachTableIds, RESERVATION_SELECT } from "@/lib/reservations";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Guest, Reservation } from "@/types";

const GUEST_TAGS = ["vip", "habitual", "alergias", "celebracion", "prensa", "conflictivo"] as const;

const UpdateGuestSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  notes: z.string().max(1000).nullable().optional(),
  allergies: z.string().max(300).nullable().optional(),
  tags: z.array(z.enum(GUEST_TAGS)).max(GUEST_TAGS.length).optional(),
});

export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;

/** Buscador de comensales del dashboard (autocompletado al crear una reserva). */
export async function searchGuests(query: string): Promise<Guest[]> {
  const session = await requireStaff();
  if (!session) return [];
  const admin = createAdminClient();
  return searchGuestsLib(admin, session.restaurantId, query);
}

/** Lista paginada de comensales, ordenada por número de visitas. */
export async function listGuests(opts: { search?: string; limit?: number; offset?: number } = {}) {
  const session = await requireStaff();
  if (!session) return { guests: [] as Guest[], total: 0 };

  const admin = createAdminClient();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  if (opts.search && opts.search.trim().length >= 2) {
    // El total se cuenta aparte: usar `guests.length` daba un total truncado a
    // una página y las coincidencias siguientes quedaban inalcanzables.
    const [guests, total] = await Promise.all([
      searchGuestsLib(admin, session.restaurantId, opts.search, limit, offset),
      countGuests(admin, session.restaurantId, opts.search),
    ]);
    return { guests, total };
  }

  const { data, count } = await admin
    .from("guests")
    .select("*", { count: "exact" })
    .eq("restaurant_id", session.restaurantId)
    .order("visits_count", { ascending: false })
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  return { guests: (data ?? []) as Guest[], total: count ?? 0 };
}

/** Ficha del comensal con todo su historial de reservas. */
export async function getGuestWithHistory(
  guestId: string,
): Promise<{ guest: Guest; reservations: Reservation[] } | null> {
  const session = await requireStaff();
  if (!session) return null;

  const admin = createAdminClient();
  const { data: guest } = await admin
    .from("guests")
    .select("*")
    .eq("id", guestId)
    .eq("restaurant_id", session.restaurantId)
    .maybeSingle();

  if (!guest) return null;

  const { data: reservations } = await admin
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("guest_id", guestId)
    .eq("restaurant_id", session.restaurantId)
    .order("starts_at", { ascending: false })
    .limit(100);

  return {
    guest: guest as Guest,
    reservations: await attachTableIds(admin, (reservations ?? []) as unknown as Reservation[]),
  };
}

/** Edita notas, alérgenos y etiquetas del comensal. */
export async function updateGuest(guestId: string, input: UpdateGuestInput) {
  const session = await requireStaff();
  if (!session) return UNAUTHORIZED;

  const parsed = UpdateGuestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();
  const patch = {
    ...parsed.data,
    ...(parsed.data.email !== undefined ? { email: parsed.data.email || null } : {}),
  };

  const { error } = await admin
    .from("guests")
    .update(patch)
    .eq("id", guestId)
    .eq("restaurant_id", session.restaurantId);

  if (error) return { error: "No se pudo actualizar la ficha del comensal." };

  await logAudit(admin, session, {
    action: "update",
    entity: "guest",
    entityId: guestId,
    metadata: { changes: patch },
  });

  revalidatePath("/dashboard/comensales");
  revalidatePath(`/dashboard/comensales/${guestId}`);
  revalidatePath("/dashboard/reservas");
  return { success: true };
}
