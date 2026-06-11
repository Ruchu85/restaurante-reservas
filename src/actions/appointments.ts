"use server";

import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { peakConcurrency } from "@/lib/availability";
import type { Appointment } from "@/types";

/**
 * Garantía de capacidad en servidor (sustituye al trigger de BD).
 * Devuelve un mensaje de error si el tramo ya está completo, o null si cabe.
 */
async function checkCapacity(
  admin: ReturnType<typeof createAdminClient>,
  salonId: string,
  startsAtISO: string,
  endsAtISO: string,
  excludeId?: string,
): Promise<string | null> {
  const start = new Date(startsAtISO);
  const end = new Date(endsAtISO);

  const [{ data: salon }, { data: bh }] = await Promise.all([
    admin.from("salons").select("slot_capacity").eq("id", salonId).maybeSingle(),
    admin
      .from("business_hours")
      .select("day_of_week, slot_capacity")
      .eq("salon_id", salonId),
  ]);

  // Día de la semana en horario de Madrid (0=Domingo)
  const madridDow = new Date(
    start.toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
  ).getDay();

  const dayCap = (bh as { day_of_week: number; slot_capacity: number | null }[] | null)?.find(
    (h) => h.day_of_week === madridDow,
  )?.slot_capacity;
  const salonCap = (salon as { slot_capacity: number | null } | null)?.slot_capacity;
  const capacity = dayCap ?? salonCap ?? 1;

  // Citas activas que solapan el rango
  const { data: overlapping } = await admin
    .from("appointments")
    .select("id, starts_at, ends_at, status")
    .eq("salon_id", salonId)
    .eq("status", "active")
    .lt("starts_at", endsAtISO)
    .gt("ends_at", startsAtISO);

  const peak = peakConcurrency(
    (overlapping ?? []) as { id: string; starts_at: string; ends_at: string; status: "active" | "cancelled" }[],
    start,
    end,
    excludeId,
  );

  if (peak >= capacity) {
    return "Este tramo ya está completo (capacidad alcanzada).";
  }
  return null;
}

const CreateSchema = z.object({
  customer_name: z.string().min(2).max(100),
  service: z.string().min(1).max(100),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  notes: z.string().max(500).optional(),
  price: z.number().min(0).max(99999).nullable().optional(),
  staff_id: z.string().uuid().nullable().optional(),
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

  // Garantía de capacidad por tramo
  const capacityError = await checkCapacity(
    admin,
    salonId,
    parsed.data.starts_at,
    parsed.data.ends_at,
  );
  if (capacityError) return { error: capacityError };

  const { data, error } = await admin
    .from("appointments")
    .insert({
      salon_id: salonId,
      staff_id: parsed.data.staff_id ?? null,
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
      return { error: "Este tramo ya está completo (capacidad alcanzada)." };
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

  // Si cambia el horario, revalidar capacidad (excluyendo la propia cita)
  if (parsed.data.starts_at && parsed.data.ends_at) {
    const salonId = await getSalonId();
    if (salonId) {
      const capacityError = await checkCapacity(
        admin,
        salonId,
        parsed.data.starts_at,
        parsed.data.ends_at,
        id,
      );
      if (capacityError) return { error: capacityError };
    }
  }

  const { error } = await admin
    .from("appointments")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    if (error.code === "23P01") {
      return { error: "Este tramo ya está completo (capacidad alcanzada)." };
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
  if (!ids.length) return { success: true, appointments: [] as Appointment[] };
  const admin = createAdminClient();
  const salonId = await getSalonId();

  // Use select("*") to avoid PostgREST 42703 errors if ticket_number/ticket_printed
  // columns don't exist yet in the production database
  const { data: existing, error: fetchError } = await admin
    .from("appointments")
    .select("*")
    .in("id", ids);

  if (fetchError) {
    console.error("[markTicketPrinted] fetch error:", fetchError.message);
    return { error: `Error al cargar citas: ${fetchError.message}` };
  }

  if (!existing || existing.length === 0) {
    // IDs not found — return empty so caller falls back to original data for PDF
    return { success: true, appointments: [] as Appointment[] };
  }

  type Row = { id: string; ticket_number?: number | null; starts_at: string };
  const rows = existing as Row[];

  const needsNumber = rows.filter((a) => !a.ticket_number);
  const alreadyNumbered = rows.filter((a) => a.ticket_number).map((a) => a.id);

  // Assign per-month sequential numbers: format YYYYMM000 (e.g. 202605001)
  // Process one at a time so each gets the correct next sequential number
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

    // maybeSingle() avoids error when no tickets exist for the month yet
    const { data: maxRow } = await admin
      .from("appointments")
      .select("ticket_number")
      .eq("salon_id", salonId ?? "")
      .gte("ticket_number", base)
      .lt("ticket_number", base + 1000)
      .not("ticket_number", "is", null)
      .order("ticket_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNum = (maxRow as { ticket_number: number } | null)?.ticket_number
      ? (maxRow as { ticket_number: number }).ticket_number + 1
      : base + 1;

    const { error: updateError } = await admin
      .from("appointments")
      .update({ ticket_printed: true, ticket_number: nextNum })
      .eq("id", appt.id);

    if (updateError) {
      // Column may not exist yet in production — log but continue so PDF still generates
      console.error("[markTicketPrinted] update error:", updateError.message);
    }
  }

  if (alreadyNumbered.length > 0) {
    const { error: updateError } = await admin
      .from("appointments")
      .update({ ticket_printed: true })
      .in("id", alreadyNumbered);

    if (updateError) {
      console.error("[markTicketPrinted] update printed error:", updateError.message);
    }
  }

  // Return the updated appointments so callers can generate PDFs with real ticket numbers
  const { data: updated } = await admin
    .from("appointments")
    .select("*")
    .in("id", ids)
    .order("starts_at");

  // "layout" revalidates all pages sharing that layout, including dynamic /citas/[id] routes
  revalidatePath("/dashboard/citas", "layout");
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard/calendario");
  return { success: true, appointments: (updated ?? []) as Appointment[] };
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
