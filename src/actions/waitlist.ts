"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff, UNAUTHORIZED } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { upsertGuest } from "@/lib/guests";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WaitlistEntry } from "@/types";

const WaitlistSchema = z.object({
  guest_name: z.string().min(2).max(100).trim(),
  guest_phone: z.string().min(6).max(30),
  guest_email: z.string().email().nullable().optional(),
  party_size: z.number().int().min(1).max(50),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida")
    .nullable()
    .optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type WaitlistInput = z.infer<typeof WaitlistSchema>;

export async function addToWaitlist(input: WaitlistInput) {
  const session = await requireStaff();
  if (!session) return UNAUTHORIZED;

  const parsed = WaitlistSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();
  const phone = normalizePhone(parsed.data.guest_phone);

  // La lista de espera también alimenta el CRM: si el cliente acaba entrando,
  // su ficha ya existe.
  await upsertGuest(admin, {
    restaurantId: session.restaurantId,
    phone,
    name: parsed.data.guest_name,
    email: parsed.data.guest_email ?? null,
  });

  const { data, error } = await admin
    .from("waitlist")
    .insert({ ...parsed.data, guest_phone: phone, restaurant_id: session.restaurantId })
    .select()
    .single();

  if (error) return { error: "No se pudo añadir a la lista de espera." };

  await logAudit(admin, session, {
    action: "create",
    entity: "waitlist",
    entityId: (data as { id: string }).id,
    metadata: { guest_name: parsed.data.guest_name, party_size: parsed.data.party_size },
  });

  revalidatePath("/dashboard/lista-espera");
  return { data };
}

export async function updateWaitlistStatus(
  id: string,
  status: "waiting" | "notified" | "seated" | "removed",
) {
  const session = await requireStaff();
  if (!session) return UNAUTHORIZED;

  if (!["waiting", "notified", "seated", "removed"].includes(status)) {
    return { error: "Estado inválido." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("waitlist")
    .update({ status })
    .eq("id", id)
    .eq("restaurant_id", session.restaurantId);

  if (error) return { error: "No se pudo actualizar la lista de espera." };

  await logAudit(admin, session, {
    action: `status:${status}`,
    entity: "waitlist",
    entityId: id,
  });

  revalidatePath("/dashboard/lista-espera");
  return { success: true };
}

export async function removeFromWaitlist(id: string) {
  return updateWaitlistStatus(id, "removed");
}

export async function getWaitlistForDate(date: string): Promise<WaitlistEntry[]> {
  const session = await requireStaff();
  if (!session) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("waitlist")
    .select("*")
    .eq("restaurant_id", session.restaurantId)
    .eq("preferred_date", date)
    .order("created_at");

  return (data ?? []) as WaitlistEntry[];
}
