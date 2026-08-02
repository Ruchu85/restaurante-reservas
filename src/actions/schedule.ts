"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, FORBIDDEN } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { madridDayRangeUtc } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const time = z.string().regex(TIME_RE, "Hora inválida (formato HH:MM)");

const BusinessHoursSchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    opens_at: time.nullable().optional(),
    closes_at: time.nullable().optional(),
    opens_at_2: time.nullable().optional(),
    closes_at_2: time.nullable().optional(),
    max_covers_per_slot: z.number().int().min(0).max(2000).nullable().optional(),
  })
  .refine((h) => !h.is_open || (h.opens_at && h.closes_at), {
    message: "Un día abierto necesita hora de apertura y de cierre.",
    path: ["opens_at"],
  })
  .refine((h) => !h.opens_at_2 || Boolean(h.closes_at_2), {
    message: "El segundo turno necesita hora de cierre.",
    path: ["closes_at_2"],
  });

const BlockedDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).nullable().optional(),
});

export type BusinessHoursInput = z.infer<typeof BusinessHoursSchema>;

export async function upsertBusinessHours(input: BusinessHoursInput) {
  const session = await requireAdmin();
  if (!session) return FORBIDDEN;

  const parsed = BusinessHoursSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();
  const restaurantId = session.restaurantId;
  const hasSplit = Boolean(parsed.data.opens_at_2 && parsed.data.closes_at_2);

  const row = {
    restaurant_id: restaurantId,
    day_of_week: parsed.data.day_of_week,
    is_open: parsed.data.is_open,
    opens_at: parsed.data.opens_at ?? null,
    closes_at: parsed.data.closes_at ?? null,
    opens_at_2: hasSplit ? parsed.data.opens_at_2 : null,
    closes_at_2: hasSplit ? parsed.data.closes_at_2 : null,
    max_covers_per_slot: parsed.data.max_covers_per_slot ?? null,
  };

  // El índice único (restaurant_id, day_of_week) es parcial
  // (WHERE restaurant_id IS NOT NULL) y Supabase no admite onConflict sobre
  // índices parciales: se hace select → update/insert a mano.
  const { data: existing } = await admin
    .from("business_hours")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("day_of_week", parsed.data.day_of_week)
    .maybeSingle();

  const { error } = existing
    ? await admin.from("business_hours").update(row).eq("id", (existing as { id: string }).id)
    : await admin.from("business_hours").insert(row);

  if (error) return { error: "No se pudo guardar el horario." };

  await logAudit(admin, session, {
    action: "update",
    entity: "business_hours",
    metadata: { ...row },
  });

  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function addBlockedDay(input: z.infer<typeof BlockedDaySchema>) {
  const session = await requireAdmin();
  if (!session) return FORBIDDEN;

  const parsed = BlockedDaySchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();

  // Cerrar un día con reservas confirmadas sin avisar deja clientes plantados.
  // La ventana es la del día natural del restaurante, no la del día UTC.
  const dayRange = madridDayRangeUtc(parsed.data.date, session.timezone);
  const { count } = await admin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", session.restaurantId)
    .in("status", ["confirmed", "seated"])
    .gte("starts_at", dayRange.from)
    .lt("starts_at", dayRange.to);

  const { error } = await admin
    .from("blocked_days")
    .insert({ ...parsed.data, restaurant_id: session.restaurantId });

  if (error) {
    if (error.code === "23505") return { error: "Ese día ya está bloqueado." };
    return { error: "No se pudo bloquear el día." };
  }

  await logAudit(admin, session, {
    action: "create",
    entity: "blocked_day",
    metadata: { date: parsed.data.date, reason: parsed.data.reason },
  });

  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/calendario");

  return {
    success: true,
    warning:
      (count ?? 0) > 0
        ? `Atención: ese día tiene ${count} reserva(s) confirmadas. Avisa a los clientes antes de cerrar.`
        : undefined,
  };
}

export async function removeBlockedDay(id: string) {
  const session = await requireAdmin();
  if (!session) return FORBIDDEN;

  const admin = createAdminClient();
  const { error } = await admin
    .from("blocked_days")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", session.restaurantId);

  if (error) return { error: "No se pudo desbloquear el día." };

  await logAudit(admin, session, { action: "delete", entity: "blocked_day", entityId: id });

  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}
