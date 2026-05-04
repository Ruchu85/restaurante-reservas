import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EditAppointmentForm } from "@/components/dashboard/EditAppointmentForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Editar cita — Panel admin" };

export default async function EditCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const [{ data: appointment }, { data: staff }, { data: businessHours }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("salon_id", salonId)
      .single(),
    supabase
      .from("staff_members")
      .select("*")
      .eq("salon_id", salonId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("business_hours")
      .select("*")
      .eq("salon_id", salonId)
      .order("day_of_week"),
  ]);

  if (!appointment) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/citas"
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a citas
        </Link>
        <h1 className="text-2xl font-bold">Editar cita</h1>
        <p className="text-sm text-muted-foreground">{appointment.customer_name} · {appointment.service}</p>
      </div>

      <EditAppointmentForm
        appointment={appointment}
        staff={staff ?? []}
        businessHours={businessHours ?? []}
      />
    </div>
  );
}
