"use server";

import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ServiceSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0).max(99999).nullable(),
  duration_minutes: z.number().int().min(5).max(480).nullable(),
});

export async function getServices() {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  const { data, error } = await admin
    .from("services")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .eq("active", true)
    .order("name");
  if (error) return { data: [], error: error.message };
  return { data: data ?? [] };
}

export async function createService(input: {
  name: string;
  price?: number | null;
  duration_minutes?: number | null;
}) {
  const parsed = ServiceSchema.safeParse({
    name: input.name,
    price: input.price ?? null,
    duration_minutes: input.duration_minutes ?? null,
  });
  if (!parsed.success) return { error: "Datos inválidos" };

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { error } = await admin.from("services").insert({
    salon_id: salonId,
    name: parsed.data.name,
    price: parsed.data.price,
    duration_minutes: parsed.data.duration_minutes,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un servicio con ese nombre." };
    return { error: error.message };
  }

  revalidatePath("/dashboard/ajustes");
  return { success: true };
}

export async function updateService(
  id: string,
  input: { name?: string; price?: number | null; duration_minutes?: number | null },
) {
  const admin = createAdminClient();
  const { error } = await admin.from("services").update(input).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/ajustes");
  return { success: true };
}

export async function deleteService(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("services").update({ active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/ajustes");
  return { success: true };
}
