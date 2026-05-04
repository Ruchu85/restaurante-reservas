"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const StaffSchema = z.object({
  salon_id: z.string().uuid(),
  name: z.string().min(2).max(100),
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
  revalidatePath("/dashboard/horarios");
  return { data };
}

export async function updateStaffMember(
  id: string,
  input: Partial<z.infer<typeof StaffSchema>>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_members")
    .update(input)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/horarios");
  return { success: true };
}
