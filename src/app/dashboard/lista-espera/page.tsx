import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/auth";
import { ListaEsperaClient } from "./ListaEsperaClient";
import type { WaitlistEntry } from "@/types";

export const metadata = { title: "Lista de Espera" };

export default async function ListaEsperaPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("waitlist")
    .select("*")
    .eq("restaurant_id", session.restaurantId)
    .in("status", ["waiting", "notified"])
    .order("created_at", { ascending: false });

  return <ListaEsperaClient entries={(entries ?? []) as WaitlistEntry[]} />;
}
