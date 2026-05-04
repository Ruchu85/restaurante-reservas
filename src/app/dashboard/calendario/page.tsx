import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/dashboard/CalendarView";

export const metadata = { title: "Calendario — Panel admin" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const today = params.date ?? new Date().toISOString().split("T")[0];

  // Fetch ±35 days around the current date for week navigation
  const dateObj = new Date(today + "T12:00:00");
  const rangeStart = new Date(dateObj);
  rangeStart.setDate(dateObj.getDate() - 35);
  const rangeEnd = new Date(dateObj);
  rangeEnd.setDate(dateObj.getDate() + 35);

  const [{ data: appointments }, { data: staff }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, staff:staff_members(id, name)")
      .eq("salon_id", salonId)
      .eq("status", "active")
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString())
      .order("starts_at"),
    supabase
      .from("staff_members")
      .select("id, name")
      .eq("salon_id", salonId)
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <CalendarView
      appointments={appointments ?? []}
      staff={staff ?? []}
      currentDate={today}
    />
  );
}
