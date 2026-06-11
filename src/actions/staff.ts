"use server";

import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { StaffMember } from "@/types";

const NameSchema = z.string().min(2).max(100).trim();

export async function getStaffMembers(): Promise<{ data: StaffMember[]; error?: string }> {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { data: [], error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("staff_members")
    .select("*")
    .eq("salon_id", salonId)
    .eq("active", true)
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: (data as StaffMember[]) ?? [] };
}

export async function createStaffMember(name: string) {
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) return { error: "El nombre debe tener al menos 2 caracteres." };

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("staff_members")
    .insert({ salon_id: salonId, name: parsed.data, active: true })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/calendario");
  return { success: true, staff: data as StaffMember };
}

export async function updateStaffMember(id: string, input: { name?: string; active?: boolean }) {
  const admin = createAdminClient();
  const { error } = await admin.from("staff_members").update(input).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function deleteStaffMember(id: string) {
  // Soft-delete: conserva el histórico de citas asignadas
  const admin = createAdminClient();
  const { error } = await admin.from("staff_members").update({ active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}
