import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/auth";
import { MesasClient } from "./MesasClient";
import type { RestaurantTable } from "@/types";

export const metadata = { title: "Gestión de Mesas" };

export default async function MesasPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: tables } = await admin
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", session.restaurantId)
    .order("sort_order");

  return (
    <MesasClient
      tables={(tables ?? []) as RestaurantTable[]}
      canEdit={session.role === "admin"}
    />
  );
}
