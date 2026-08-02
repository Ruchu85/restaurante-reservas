"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, FORBIDDEN } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateRestaurantSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  address: z.string().max(200).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  description: z.string().max(500).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal("")),
  max_party_size: z.number().int().min(1).max(50),
  min_advance_hours: z.number().int().min(0).max(72),
  max_advance_days: z.number().int().min(1).max(365),
  reservation_duration_minutes: z.number().int().min(30).max(480),
  max_covers_per_slot: z.number().int().min(0).max(2000).nullable().optional(),
  allow_table_combination: z.boolean().optional(),
  last_seating_offset_minutes: z.number().int().min(0).max(240).optional(),
  large_party_threshold: z.number().int().min(1).max(50).optional(),
  large_party_duration_minutes: z.number().int().min(0).max(480).nullable().optional(),
  block_online_after_no_shows: z.number().int().min(0).max(20).nullable().optional(),
});

export type UpdateRestaurantInput = z.infer<typeof UpdateRestaurantSchema>;

export async function updateRestaurant(input: UpdateRestaurantInput) {
  const session = await requireAdmin();
  if (!session) return FORBIDDEN;

  const parsed = UpdateRestaurantSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();

  // Los campos vacíos del formulario se guardan como NULL, no como "".
  const patch = {
    ...parsed.data,
    email: parsed.data.email || null,
    website: parsed.data.website || null,
    // 0 en el formulario significa "sin límite" / "usar el valor por defecto".
    max_covers_per_slot: parsed.data.max_covers_per_slot || null,
    large_party_duration_minutes: parsed.data.large_party_duration_minutes || null,
    block_online_after_no_shows: parsed.data.block_online_after_no_shows || null,
  };

  const { error } = await admin
    .from("restaurants")
    .update(patch)
    .eq("id", session.restaurantId);

  if (error) return { error: "No se pudo guardar la configuración." };

  await logAudit(admin, session, {
    action: "update",
    entity: "restaurant",
    entityId: session.restaurantId,
    metadata: { changes: patch },
  });

  revalidatePath("/dashboard/ajustes");
  revalidatePath("/dashboard/calendario");
  revalidatePath("/reservar");
  return { success: true };
}
