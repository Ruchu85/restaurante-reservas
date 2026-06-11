"use server";

import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SalonSchema = z.object({
  name: z.string().min(1).max(120),
  owner: z.string().max(120).nullable().optional(),
  nif: z.string().max(40).nullable().optional(),
  address: z.string().max(160).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  ticket_footer: z.string().max(200).nullable().optional(),
});

export async function updateSalonInfo(input: z.infer<typeof SalonSchema>) {
  const parsed = SalonSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { error } = await admin
    .from("salons")
    .update(parsed.data)
    .eq("id", salonId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/ajustes");
  revalidatePath("/dashboard/tickets");
  return { success: true };
}

export async function updateSlotCapacity(capacity: number) {
  const cap = Math.max(1, Math.min(10, Math.round(capacity)));
  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { error } = await admin
    .from("salons")
    .update({ slot_capacity: cap })
    .eq("id", salonId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/ajustes");
  revalidatePath("/dashboard/calendario");
  return { success: true, capacity: cap };
}
