import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/dashboard/CalendarView";

export const metadata = { title: "Calendario — Salón Demo" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const today = params.date ?? new Date().toISOString().split("T")[0];

  // Fetch appointments for the week/month containing `today`
  const dateObj = new Date(today + "T12:00:00");
  const weekStart = new Date(dateObj);
  weekStart.setDate(dateObj.getDate() - dateObj.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, service:services(name, duration_minutes), staff:staff_members(display_name)")
    .eq("salon_id", salonId)
    .gte("starts_at", weekStart.toISOString())
    .lte("starts_at", weekEnd.toISOString())
    .not("status", "in", '("cancelled","no_show")')
    .order("starts_at");

  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, display_name")
    .eq("salon_id", salonId)
    .eq("active", true);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-sm text-muted-foreground">Vista de la agenda por semana</p>
      </div>
      <CalendarView
        appointments={appointments ?? []}
        staff={staff ?? []}
        currentDate={today}
      />
    </div>
  );
}
