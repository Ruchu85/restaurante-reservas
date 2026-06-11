import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { getSalon, salonToTicketInfo } from "@/lib/salon";
import { CalendarView } from "@/components/dashboard/CalendarView";

export const metadata = { title: "Calendario — PELUQUERIA ALI" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();
  const salonId = await getSalonId();
  const salon = await getSalon();

  const today = params.date ?? new Date().toISOString().split("T")[0];

  const dateObj = new Date(today + "T12:00:00");
  const rangeStart = new Date(dateObj);
  rangeStart.setDate(dateObj.getDate() - 60);
  const rangeEnd = new Date(dateObj);
  rangeEnd.setDate(dateObj.getDate() + 60);

  const [
    { data: appointments },
    { data: staff },
    { data: blockedDays },
    { data: businessHours },
  ] = await Promise.all([
    admin
      .from("appointments")
      .select("*, staff:staff_members(id, name)")
      .eq("salon_id", salonId ?? "")
      .eq("status", "active")
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString())
      .order("starts_at"),
    admin
      .from("staff_members")
      .select("id, name")
      .eq("salon_id", salonId ?? "")
      .eq("active", true)
      .order("name"),
    admin
      .from("blocked_days")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .gte("date", rangeStart.toISOString().split("T")[0])
      .lte("date", rangeEnd.toISOString().split("T")[0]),
    admin
      .from("business_hours")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .order("day_of_week"),
  ]);

  return (
    <CalendarView
      appointments={
        (appointments ?? []).map((a) => ({
          ticket_number: null,
          price: null,
          ...a,
        })) as Parameters<typeof CalendarView>[0]["appointments"]
      }
      staff={staff ?? []}
      currentDate={today}
      blockedDays={blockedDays ?? []}
      businessHours={businessHours ?? []}
      capacity={salon?.slot_capacity ?? 1}
      salonInfo={salonToTicketInfo(salon)}
    />
  );
}
