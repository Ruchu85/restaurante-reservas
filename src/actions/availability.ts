"use server";

import { createClient } from "@/lib/supabase/server";
import { computeAvailableSlots } from "@/lib/availability";
import type { TimeSlot } from "@/types";

export async function getAvailableSlots(
  salonId: string,
  serviceId: string,
  date: string,
  staffId?: string,
): Promise<{ slots?: TimeSlot[]; error?: string }> {
  const supabase = await createClient();

  const [
    { data: service, error: svcErr },
    { data: businessHours, error: bhErr },
    { data: staff, error: stErr },
    { data: appointments, error: apptErr },
    { data: timeOffs, error: toErr },
  ] = await Promise.all([
    supabase.from("services").select("*").eq("id", serviceId).single(),
    supabase.from("business_hours").select("*").eq("salon_id", salonId),
    supabase
      .from("staff_members")
      .select("*")
      .eq("salon_id", salonId)
      .eq("active", true),
    supabase
      .from("appointments")
      .select("*")
      .eq("salon_id", salonId)
      .gte("starts_at", `${date}T00:00:00Z`)
      .lte("starts_at", `${date}T23:59:59Z`),
    supabase
      .from("staff_time_off")
      .select("*")
      .eq("salon_id", salonId)
      .lte("starts_at", `${date}T23:59:59Z`)
      .gte("ends_at", `${date}T00:00:00Z`),
  ]);

  if (svcErr || !service) return { error: "Servicio no encontrado" };
  if (bhErr) return { error: "Error al cargar horarios" };
  if (stErr) return { error: "Error al cargar profesionales" };
  if (apptErr) return { error: "Error al cargar citas" };
  if (toErr) return { error: "Error al cargar ausencias" };

  const slots = computeAvailableSlots({
    date,
    service,
    businessHours: businessHours ?? [],
    staffMembers: staff ?? [],
    existingAppointments: appointments ?? [],
    staffTimeOffs: timeOffs ?? [],
    staffId,
  });

  return { slots };
}
