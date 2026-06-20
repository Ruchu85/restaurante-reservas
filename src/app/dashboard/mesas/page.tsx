import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { MesasClient } from "./MesasClient";
import type { RestaurantTable } from "@/types";

export const metadata = { title: "Gestión de Mesas" };

export default async function MesasPage() {
  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();

  const { data: tables } = await admin
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", restaurantId ?? "")
    .order("sort_order");

  return <MesasClient tables={(tables ?? []) as RestaurantTable[]} />;
}
