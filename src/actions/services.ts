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

  // Check if a service with this name already exists (active or soft-deleted)
  const { data: existing } = await admin
    .from("services")
    .select("id, active")
    .eq("salon_id", salonId)
    .eq("name", parsed.data.name)
    .maybeSingle();

  if (existing?.active) {
    return { error: "Ya existe un servicio con ese nombre." };
  }

  let service;
  if (existing && !existing.active) {
    // Reactivate the soft-deleted service with new price/duration
    const { data, error } = await admin
      .from("services")
      .update({
        active: true,
        price: parsed.data.price,
        duration_minutes: parsed.data.duration_minutes,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return { error: error.message };
    service = data;
  } else {
    const { data, error } = await admin
      .from("services")
      .insert({
        salon_id: salonId,
        name: parsed.data.name,
        price: parsed.data.price,
        duration_minutes: parsed.data.duration_minutes,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    service = data;
  }

  revalidatePath("/dashboard/ajustes");
  return { success: true, service };
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
