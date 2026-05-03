"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppointmentStatus } from "@/types";
import { addMinutes } from "@/lib/utils";

const BookingSchema = z.object({
  salon_id: z.string().uuid(),
  service_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable(),
  starts_at: z.string().datetime(),
  customer_name: z.string().min(2).max(100),
  customer_email: z.string().email(),
  customer_phone: z.string().min(6).max(20),
  notes: z.string().max(500).optional(),
});

export type BookingInput = z.infer<typeof BookingSchema>;

export async function createAppointment(input: BookingInput) {
  const parsed = BookingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Datos inválidos: " + parsed.error.message };
  }

  const supabase = await createClient();

  // Obtener duración del servicio para calcular ends_at
  const { data: service, error: svcErr } = await supabase
    .from("services")
    .select("duration_minutes, buffer_before_minutes, buffer_after_minutes")
    .eq("id", parsed.data.service_id)
    .single();

  if (svcErr || !service) {
    return { error: "Servicio no encontrado" };
  }

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = addMinutes(startsAt, service.duration_minutes);

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: parsed.data.salon_id,
      service_id: parsed.data.service_id,
      staff_id: parsed.data.staff_id,
      customer_name: parsed.data.customer_name,
      customer_email: parsed.data.customer_email,
      customer_phone: parsed.data.customer_phone,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "pending",
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23P01") {
      // exclusion constraint violation
      return {
        error:
          "Lo sentimos, ese horario ya no está disponible. Por favor elige otro.",
      };
    }
    return { error: "No se pudo crear la cita. Inténtalo de nuevo." };
  }

  return { data };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/calendario");
  return { success: true };
}

export async function cancelAppointment(appointmentId: string) {
  return updateAppointmentStatus(appointmentId, "cancelled");
}

export async function getAppointmentsByDate(salonId: string, date: string) {
  const supabase = await createClient();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `*, service:services(name, duration_minutes, price_cents), staff:staff_members(display_name)`,
    )
    .eq("salon_id", salonId)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd)
    .order("starts_at");

  if (error) return { error: error.message };
  return { data };
}
