"use server";

import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Customer } from "@/types";

export async function getCustomers(): Promise<{ data?: Customer[]; error?: string }> {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("customers")
    .select("*")
    .eq("salon_id", salonId)
    .order("name");

  if (error) return { error: error.message };
  return { data: data as Customer[] };
}

const NameSchema = z.string().min(2).max(100).trim();

export async function upsertCustomer(
  name: string,
  preferredService?: string | null,
): Promise<{ data?: Customer; error?: string }> {
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) return { error: "Nombre inválido." };

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const trimmedName = parsed.data;

  // Try to find existing customer (case-insensitive)
  const { data: existing } = await admin
    .from("customers")
    .select("*")
    .eq("salon_id", salonId)
    .ilike("name", trimmedName)
    .maybeSingle();

  if (existing) {
    // Update preferred_service if a service is provided
    if (preferredService) {
      await admin
        .from("customers")
        .update({ preferred_service: preferredService })
        .eq("id", existing.id);
    }
    return { data: { ...existing, preferred_service: preferredService ?? existing.preferred_service } as Customer };
  }

  // Create new customer
  const { data: created, error } = await admin
    .from("customers")
    .insert({ salon_id: salonId, name: trimmedName, preferred_service: preferredService ?? null })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/clientes");
  return { data: created as Customer };
}

export async function createCustomer(
  name: string,
): Promise<{ data?: Customer; error?: string }> {
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) return { error: "El nombre debe tener al menos 2 caracteres." };

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("customers")
    .insert({ salon_id: salonId, name: parsed.data })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un cliente con ese nombre." };
    return { error: error.message };
  }

  revalidatePath("/dashboard/clientes");
  return { data: data as Customer };
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin.from("customers").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/clientes");
  return {};
}
