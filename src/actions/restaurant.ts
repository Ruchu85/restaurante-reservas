"use server";

import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateRestaurantSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().max(200).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  website: z.string().url().nullable().optional(),
  max_party_size: z.number().int().min(1).max(50),
  min_advance_hours: z.number().int().min(0).max(72),
  max_advance_days: z.number().int().min(1).max(365),
  reservation_duration_minutes: z.number().int().min(30).max(480),
});

export type UpdateRestaurantInput = z.infer<typeof UpdateRestaurantSchema>;

export async function updateRestaurant(input: UpdateRestaurantInput) {
  const parsed = UpdateRestaurantSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();
  const id = await getRestaurantId();
  if (!id) return { error: "Restaurante no encontrado." };

  const { error } = await admin
    .from("restaurants")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/ajustes");
  return { success: true };
}
