"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff, requireAdmin, UNAUTHORIZED, FORBIDDEN } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TableSchema = z
  .object({
    name: z.string().min(1).max(50).trim(),
    capacity: z.number().int().min(1).max(100),
    min_capacity: z.number().int().min(1).max(100),
    section: z.enum(["interior", "terraza", "barra", "privado", "sala_vip"]),
    sort_order: z.number().int().min(0).optional(),
    combinable: z.boolean().optional(),
  })
  .refine((t) => t.min_capacity <= t.capacity, {
    message: "La capacidad mínima no puede superar a la capacidad de la mesa.",
    path: ["min_capacity"],
  });

export type TableInput = z.infer<typeof TableSchema>;

export async function createTable(input: TableInput) {
  const session = await requireAdmin();
  if (!session) return FORBIDDEN;

  const parsed = TableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("restaurant_tables")
    .insert({ ...parsed.data, restaurant_id: session.restaurantId })
    .select()
    .single();

  if (error) return { error: "No se pudo crear la mesa." };

  await logAudit(admin, session, {
    action: "create",
    entity: "table",
    entityId: (data as { id: string }).id,
    metadata: { name: parsed.data.name },
  });

  revalidatePath("/dashboard/mesas");
  return { data };
}

export async function updateTable(id: string, input: Partial<TableInput>) {
  const session = await requireAdmin();
  if (!session) return FORBIDDEN;

  // `.partial()` sobre un schema con `.refine()` no está permitido en Zod,
  // así que se valida el objeto interior y la coherencia se comprueba aparte.
  const parsed = TableSchema.innerType().partial().safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };
  if (
    parsed.data.min_capacity !== undefined &&
    parsed.data.capacity !== undefined &&
    parsed.data.min_capacity > parsed.data.capacity
  ) {
    return { error: "La capacidad mínima no puede superar a la capacidad de la mesa." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurant_tables")
    .update(parsed.data)
    .eq("id", id)
    .eq("restaurant_id", session.restaurantId);

  if (error) return { error: "No se pudo actualizar la mesa." };

  await logAudit(admin, session, {
    action: "update",
    entity: "table",
    entityId: id,
    metadata: { changes: parsed.data },
  });

  revalidatePath("/dashboard/mesas");
  return { success: true };
}

export async function toggleTableActive(id: string, active: boolean) {
  const session = await requireStaff();
  if (!session) return UNAUTHORIZED;

  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurant_tables")
    .update({ active })
    .eq("id", id)
    .eq("restaurant_id", session.restaurantId);

  if (error) return { error: "No se pudo cambiar el estado de la mesa." };

  await logAudit(admin, session, {
    action: active ? "activate" : "deactivate",
    entity: "table",
    entityId: id,
  });

  revalidatePath("/dashboard/mesas");
  return { success: true };
}

export async function deleteTable(id: string) {
  const session = await requireAdmin();
  if (!session) return FORBIDDEN;

  const admin = createAdminClient();

  // Borrar una mesa con reservas futuras las deja huérfanas (table_id → null)
  // sin que nadie se entere. Se bloquea y se sugiere desactivarla, que es lo
  // que el usuario realmente quiere hacer.
  const { count } = await admin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", session.restaurantId)
    .eq("table_id", id)
    .in("status", ["confirmed", "seated"])
    .gte("starts_at", new Date().toISOString());

  if ((count ?? 0) > 0) {
    return {
      error: `La mesa tiene ${count} reserva(s) futuras. Desactívala en lugar de eliminarla.`,
    };
  }

  const { error } = await admin
    .from("restaurant_tables")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", session.restaurantId);

  if (error) return { error: "No se pudo eliminar la mesa." };

  await logAudit(admin, session, { action: "delete", entity: "table", entityId: id });

  revalidatePath("/dashboard/mesas");
  return { success: true };
}
