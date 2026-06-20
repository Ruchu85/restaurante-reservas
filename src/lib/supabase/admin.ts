import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function getRestaurantId(): Promise<string | null> {
  const slug = process.env.NEXT_PUBLIC_RESTAURANT_SLUG ?? "restaurante-demo";
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .single();
  return data?.id ?? null;
}
