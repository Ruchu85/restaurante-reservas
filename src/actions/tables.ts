"use server";

import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TableSchema = z.object({
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(100),
  min_capacity: z.number().int().min(1).max(100),
  section: z.enum(["interior", "terraza", "barra", "privado", "sala_vip"]),
  sort_order: z.number().int().min(0).optional(),
});

export type TableInput = z.infer<typeof TableSchema>;

export async function createTable(input: TableInput) {
  const parsed = TableSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { error: "Restaurante no encontrado." };

  const { data, error } = await admin
    .from("restaurant_tables")
    .insert({ ...parsed.data, restaurant_id: restaurantId })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/mesas");
  return { data };
}

export async function updateTable(id: string, input: Partial<TableInput>) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurant_tables")
    .update(input)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/mesas");
  return { success: true };
}

export async function toggleTableActive(id: string, active: boolean) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurant_tables")
    .update({ active })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/mesas");
  return { success: true };
}

export async function deleteTable(id: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurant_tables")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/mesas");
  return { success: true };
}
