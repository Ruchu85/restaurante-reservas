"use server";

import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const WaitlistSchema = z.object({
  guest_name: z.string().min(2).max(100),
  guest_phone: z.string().min(6).max(30),
  guest_email: z.string().email().nullable().optional(),
  party_size: z.number().int().min(1).max(50),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type WaitlistInput = z.infer<typeof WaitlistSchema>;

export async function addToWaitlist(input: WaitlistInput) {
  const parsed = WaitlistSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { error: "Restaurante no encontrado." };

  const { data, error } = await admin
    .from("waitlist")
    .insert({ ...parsed.data, restaurant_id: restaurantId })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/lista-espera");
  return { data };
}

export async function updateWaitlistStatus(
  id: string,
  status: "waiting" | "notified" | "seated" | "removed",
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("waitlist")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/lista-espera");
  return { success: true };
}

export async function removeFromWaitlist(id: string) {
  return updateWaitlistStatus(id, "removed");
}
