import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { ClientesClient } from "./ClientesClient";
import type { Customer } from "@/types";

export const metadata = { title: "Clientes — PELUQUERIA ALI" };

export default async function ClientesPage() {
  const admin = createAdminClient();
  const salonId = await getSalonId();

  const { data: customers } = await admin
    .from("customers")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .order("name");

  return <ClientesClient customers={(customers as Customer[]) ?? []} />;
}
