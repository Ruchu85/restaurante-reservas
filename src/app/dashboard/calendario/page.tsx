import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/auth";
import { getBusinessHours, getBlockedDays, getActiveTables } from "@/lib/restaurant";
import { getReservationsForRange } from "@/lib/reservations";
import { toLocalDate, addDays } from "@/lib/dates";
import { CalendarClient } from "./CalendarClient";

export const metadata = { title: "Calendario de Reservas" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const { date: paramDate } = await searchParams;
  const today =
    paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : toLocalDate(new Date(), session.timezone);

  const admin = createAdminClient();
  const rid = session.restaurantId;

  // ±60 días alrededor del día visible, para poder navegar sin recargar.
  const fromStr = addDays(today, -60);
  const toStr = addDays(today, 60);

  const [reservations, businessHours, blockedDays, tables] = await Promise.all([
    getReservationsForRange(admin, rid, fromStr, toStr, {
      withRelations: true,
      timeZone: session.timezone,
    }),
    getBusinessHours(admin, rid),
    getBlockedDays(admin, rid, fromStr, toStr),
    getActiveTables(admin, rid),
  ]);

  return (
    <CalendarClient
      initialReservations={reservations.filter((r) =>
        ["confirmed", "seated", "completed"].includes(r.status),
      )}
      businessHours={businessHours}
      blockedDays={blockedDays}
      tables={tables}
      today={today}
      timeZone={session.timezone}
    />
  );
}
