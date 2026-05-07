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
  price: z.number().min(0).max(99999).nullable().optional(),
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

  // Check blocked day
  const dateStr = parsed.data.starts_at.substring(0, 10);
  const { data: blocked } = await admin
    .from("blocked_days")
    .select("id")
    .eq("salon_id", salonId)
    .eq("date", dateStr)
    .maybeSingle();

  if (blocked) {
    return { error: "No se pueden crear citas en días bloqueados o de vacaciones." };
  }

  // Check business hours
  const startDate = new Date(parsed.data.starts_at);
  const dayOfWeek = startDate.getUTCDay();
  const { data: bh } = await admin
    .from("business_hours")
    .select("is_open")
    .eq("salon_id", salonId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (bh && !bh.is_open) {
    return { error: "El salón no abre ese día según el horario configurado." };
  }

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
      price: parsed.data.price ?? null,
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
  const salonId = await getSalonId();

  // Fetch appointments including starts_at to determine the billing month
  const { data: existing } = await admin
    .from("appointments")
    .select("id, ticket_number, starts_at")
    .in("id", ids);

  if (!existing) return { success: true };

  const needsNumber = existing.filter((a) => !a.ticket_number);
  const alreadyNumbered = existing.filter((a) => a.ticket_number).map((a) => a.id);

  // Assign per-month sequential numbers: format YYYYMM000 (e.g. 202605001)
  for (const appt of needsNumber) {
    const d = new Date(appt.starts_at);
    const parts = new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "2-digit",
      timeZone: "Europe/Madrid",
    }).formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value ?? String(d.getFullYear());
    const month = parts.find((p) => p.type === "month")?.value ?? String(d.getMonth() + 1).padStart(2, "0");
    const yyyymm = parseInt(year + month); // e.g. 202605
    const base = yyyymm * 1000;            // e.g. 202605000

    const { data: maxRow } = await admin
      .from("appointments")
      .select("ticket_number")
      .eq("salon_id", salonId ?? "")
      .gte("ticket_number", base)
      .lt("ticket_number", base + 1000)
      .not("ticket_number", "is", null)
      .order("ticket_number", { ascending: false })
      .limit(1)
      .single();

    const nextNum = (maxRow as { ticket_number: number } | null)?.ticket_number
      ? (maxRow as { ticket_number: number }).ticket_number + 1
      : base + 1;

    await admin
      .from("appointments")
      .update({ ticket_printed: true, ticket_number: nextNum })
      .eq("id", appt.id);
  }

  if (alreadyNumbered.length > 0) {
    await admin
      .from("appointments")
      .update({ ticket_printed: true })
      .in("id", alreadyNumbered);
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/tickets");
  return { success: true };
}

export async function getTickets(from: string, to: string) {
  const admin = createAdminClient();
  const salonId = await getSalonId();

  const { data, error } = await admin
    .from("appointments")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .eq("status", "active")
    .gte("starts_at", from + "T00:00:00.000Z")
    .lte("starts_at", to + "T23:59:59.999Z")
    .order("starts_at");

  if (error) return { error: error.message };
  return { data: data as unknown as import("@/types").Appointment[] };
}
