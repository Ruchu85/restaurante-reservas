import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { ListaEsperaClient } from "./ListaEsperaClient";
import type { WaitlistEntry } from "@/types";

export const metadata = { title: "Lista de Espera" };

export default async function ListaEsperaPage() {
  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();

  const { data: entries } = await admin
    .from("waitlist")
    .select("*")
    .eq("restaurant_id", restaurantId ?? "")
    .in("status", ["waiting", "notified"])
    .order("created_at", { ascending: false });

  return <ListaEsperaClient entries={(entries ?? []) as WaitlistEntry[]} />;
}
