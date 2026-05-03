"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ServiceSchema = z.object({
  salon_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  duration_minutes: z.number().int().positive(),
  buffer_before_minutes: z.number().int().min(0).default(0),
  buffer_after_minutes: z.number().int().min(0).default(0),
  price_cents: z.number().int().min(0),
  active: z.boolean().default(true),
});

export async function createService(input: z.infer<typeof ServiceSchema>) {
  const parsed = ServiceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicios");
  return { data };
}

export async function updateService(
  id: string,
  input: Partial<z.infer<typeof ServiceSchema>>,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicios");
  return { data };
}

export async function deleteService(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/servicios");
  return { success: true };
}

export async function getPublicServices(salonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", salonId)
    .eq("active", true)
    .order("name");

  if (error) return { error: error.message };
  return { data };
}
