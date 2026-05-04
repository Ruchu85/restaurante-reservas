"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AppointmentSchema = z.object({
  salon_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable(),
  customer_name: z.string().min(2).max(100),
  service: z.string().min(1).max(100),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export type AppointmentInput = z.infer<typeof AppointmentSchema>;

export async function createAppointment(input: AppointmentInput) {
  const parsed = AppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Datos inválidos: " + parsed.error.message };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: parsed.data.salon_id,
      staff_id: parsed.data.staff_id,
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
      return { error: "Ese horario ya está ocupado para este profesional." };
    }
    return { error: "No se pudo crear la cita. Inténtalo de nuevo." };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/calendario");
  return { data };
}

export async function updateAppointment(id: string, input: Partial<AppointmentInput>) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update(input)
    .eq("id", id);

  if (error) {
    if (error.code === "23P01") {
      return { error: "Ese horario ya está ocupado para este profesional." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function cancelAppointment(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function getAppointmentsByDate(salonId: string, date: string) {
  const supabase = await createClient();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("appointments")
    .select("*, staff:staff_members(id, name)")
    .eq("salon_id", salonId)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd)
    .eq("status", "active")
    .order("starts_at");

  if (error) return { error: error.message };
  return { data };
}
