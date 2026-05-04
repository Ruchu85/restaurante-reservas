import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { NewAppointmentForm } from "@/components/dashboard/NewAppointmentForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Nueva cita — Panel admin" };

export default async function NuevaCitaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();
  const salonId = await getSalonId();

  const today = new Date();
  const selectedDate = params.date ?? today.toISOString().split("T")[0];

  // Fetch next 31 days of appointments so the slot picker works when user changes date
  const rangeStart = new Date(selectedDate + "T00:00:00");
  rangeStart.setDate(rangeStart.getDate() - 1);
  const rangeEnd = new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000);

  const [{ data: businessHours }, { data: appointments }] = await Promise.all([
    admin
      .from("business_hours")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .order("day_of_week"),
    admin
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("salon_id", salonId ?? "")
      .eq("status", "active")
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString()),
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
        initialDate={params.date}
        businessHours={businessHours ?? []}
        existingAppointments={appointments ?? []}
      />
    </div>
  );
}
