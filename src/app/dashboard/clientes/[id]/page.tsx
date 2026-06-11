import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { CustomerDetailClient } from "./CustomerDetailClient";
import type { Appointment, Customer } from "@/types";

export const metadata = { title: "Ficha de cliente — PELUQUERIA ALI" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const salonId = await getSalonId();

  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("salon_id", salonId ?? "")
    .maybeSingle();

  if (!customer) notFound();
  const cust = customer as Customer;

  const { data: appts } = await admin
    .from("appointments")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .ilike("customer_name", cust.name)
    .order("starts_at", { ascending: false })
    .limit(200);

  const appointments = (appts ?? []).map((a) => ({ ticket_number: null, price: null, ...a })) as Appointment[];

  return <CustomerDetailClient customer={cust} appointments={appointments} />;
}
