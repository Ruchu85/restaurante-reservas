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
  const salonId = await getSalonId();

  // Check if ticket_number column exists (migration may not have run yet)
  const { error: colCheck } = await admin
    .from("appointments")
    .select("ticket_number")
    .limit(1);

  const hasTicketNumberCol = !colCheck;

  if (hasTicketNumberCol) {
    const { data: existing } = await admin
      .from("appointments")
      .select("id, ticket_number")
      .in("id", ids);

    const needsNumber = existing?.filter((a: Record<string, unknown>) => !a.ticket_number).map((a: Record<string, unknown>) => a.id as string) ?? [];

    if (needsNumber.length > 0) {
      const { data: maxRow } = await admin
        .from("appointments")
        .select("ticket_number")
        .eq("salon_id", salonId ?? "")
        .not("ticket_number", "is", null)
        .order("ticket_number", { ascending: false })
        .limit(1)
        .single();

      let next = ((maxRow as { ticket_number: number } | null)?.ticket_number ?? 200) + 1;

      for (const id of needsNumber) {
        await admin
          .from("appointments")
          .update({ ticket_printed: true, ticket_number: next++ })
          .eq("id", id);
      }
    }

    const alreadyNumbered = ids.filter((id) => !needsNumber.includes(id));
    if (alreadyNumbered.length > 0) {
      await admin.from("appointments").update({ ticket_printed: true }).in("id", alreadyNumbered);
    }
  } else {
    // Column not yet created — just mark as printed
    await admin.from("appointments").update({ ticket_printed: true }).in("id", ids);
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
