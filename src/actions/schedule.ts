"use server";

import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function upsertBusinessHours(
  dayOfWeek: number,
  opensAt: string,
  closesAt: string,
  isOpen: boolean
) {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { error } = await admin
    .from("business_hours")
    .upsert(
      { salon_id: salonId, day_of_week: dayOfWeek, opens_at: opensAt, closes_at: closesAt, is_open: isOpen },
      { onConflict: "salon_id,day_of_week" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/horarios");
  return { success: true };
}

export async function addBlockedDay(date: string, reason: string | null) {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return { error: "No se encontró el salón." };

  const { data, error } = await admin
    .from("blocked_days")
    .insert({ salon_id: salonId, date, reason })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Ya existe un cierre para esa fecha." };
    return { error: error.message };
  }
  revalidatePath("/dashboard/horarios");
  return { data };
}

export async function removeBlockedDay(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("blocked_days").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/horarios");
  return { success: true };
}
