"use server";

import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const BusinessHoursSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  opens_at: z.string().nullable().optional(),
  closes_at: z.string().nullable().optional(),
  opens_at_2: z.string().nullable().optional(),
  closes_at_2: z.string().nullable().optional(),
});

const BlockedDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).nullable().optional(),
});

export type BusinessHoursInput = z.infer<typeof BusinessHoursSchema>;

export async function upsertBusinessHours(input: BusinessHoursInput) {
  const parsed = BusinessHoursSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { error: "Restaurante no encontrado." };

  const hasSplit = Boolean(parsed.data.opens_at_2 && parsed.data.closes_at_2);

  const { error } = await admin
    .from("business_hours")
    .upsert(
      {
        restaurant_id: restaurantId,
        day_of_week: parsed.data.day_of_week,
        is_open: parsed.data.is_open,
        opens_at: parsed.data.opens_at ?? null,
        closes_at: parsed.data.closes_at ?? null,
        opens_at_2: hasSplit ? parsed.data.opens_at_2 : null,
        closes_at_2: hasSplit ? parsed.data.closes_at_2 : null,
      },
      { onConflict: "restaurant_id,day_of_week" },
    );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function addBlockedDay(input: z.infer<typeof BlockedDaySchema>) {
  const parsed = BlockedDaySchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { error: "Restaurante no encontrado." };

  const { error } = await admin
    .from("blocked_days")
    .insert({ ...parsed.data, restaurant_id: restaurantId });

  if (error) {
    if (error.code === "23505") return { error: "Ese día ya está bloqueado." };
    return { error: error.message };
  }

  revalidatePath("/dashboard/horarios");
  return { success: true };
}

export async function removeBlockedDay(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("blocked_days").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/horarios");
  return { success: true };
}
