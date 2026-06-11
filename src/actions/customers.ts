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
  phone?: string | null,
): Promise<{ data?: Customer; error?: string }> {
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) return { error: "El nombre debe tener al menos 2 caracteres." };

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("customers")
    .insert({ salon_id: salonId, name: parsed.data, phone: phone?.trim() || null })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un cliente con ese nombre." };
    return { error: error.message };
  }

  revalidatePath("/dashboard/clientes");
  return { data: data as Customer };
}

const UpdateCustomerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(40).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  preferred_service: z.string().max(100).nullable().optional(),
});

export async function updateCustomer(
  id: string,
  input: z.infer<typeof UpdateCustomerSchema>,
): Promise<{ success?: boolean; error?: string }> {
  const parsed = UpdateCustomerSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const payload = {
    ...parsed.data,
    phone: parsed.data.phone?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
  };

  const { error } = await admin
    .from("customers")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", salonId);

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un cliente con ese nombre." };
    return { error: error.message };
  }

  revalidatePath("/dashboard/clientes");
  revalidatePath(`/dashboard/clientes/${id}`);
  return { success: true };
}

export async function getCustomerById(
  id: string,
): Promise<{ data?: Customer; error?: string }> {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Cliente no encontrado." };
  return { data: data as Customer };
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin.from("customers").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/clientes");
  return {};
}
