import { createClient } from "@/lib/supabase/server";
import { NewAppointmentForm } from "@/components/dashboard/NewAppointmentForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Nueva cita — Panel admin" };

export default async function NuevaCitaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; staff?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const [{ data: staff }, { data: businessHours }] = await Promise.all([
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
        <h1 className="text-2xl font-bold">Nueva cita</h1>
        <p className="text-sm text-muted-foreground">Crea una cita en la agenda</p>
      </div>

      <NewAppointmentForm
        salonId={salonId}
        staff={staff ?? []}
        businessHours={businessHours ?? []}
        initialDate={params.date}
        initialStaffId={params.staff}
      />
    </div>
  );
}
