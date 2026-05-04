"use server";

import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateSchema = z.object({
  customer_name: z.string().min(2).max(100),
  service: z.string().min(1).max(100),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

const UpdateSchema = CreateSchema.partial();

export type CreateAppointmentInput = z.infer<typeof CreateSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateSchema>;

export async function createAppointment(input: CreateAppointmentInput) {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Datos inválidos: " + parsed.error.message };
  }

  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("appointments")
    .insert({
      salon_id: salonId,
      staff_id: null,
      customer_name: parsed.data.customer_name,
      service: parsed.data.service,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
      notes: parsed.data.notes ?? null,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23P01") {
      return { error: "Ese horario ya está ocupado." };
    }
    return { error: "No se pudo crear la cita. Inténtalo de nuevo." };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/calendario");
  return { data };
}

export async function updateAppointment(id: string, input: UpdateAppointmentInput) {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Datos inválidos: " + parsed.error.message };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("appointments")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    if (error.code === "23P01") {
      return { error: "Ese horario ya está ocupado." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function cancelAppointment(id: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function markTicketPrinted(ids: string[]) {
  if (!ids.length) return { success: true };
  const admin = createAdminClient();

  const { error } = await admin
    .from("appointments")
    .update({ ticket_printed: true })
    .in("id", ids);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/citas");
  return { success: true };
}
