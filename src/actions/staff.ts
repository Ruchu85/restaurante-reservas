"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const StaffSchema = z.object({
  salon_id: z.string().uuid(),
  display_name: z.string().min(2).max(100),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  active: z.boolean().default(true),
});

export async function createStaffMember(input: z.infer<typeof StaffSchema>) {
  const parsed = StaffSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_members")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/equipo");
  return { data };
}

export async function updateStaffMember(
  id: string,
  input: Partial<z.infer<typeof StaffSchema>>,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_members")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/equipo");
  return { data };
}

export async function getPublicStaff(salonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, display_name, bio, avatar_url")
    .eq("salon_id", salonId)
    .eq("active", true)
    .order("display_name");

  if (error) return { error: error.message };
  return { data };
}
