import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRestaurant, getActiveTables } from "@/lib/restaurant";
import { getReservationsForServiceDay } from "@/lib/reservations";
import { toLocalDate } from "@/lib/dates";
import { ReservasClient } from "./ReservasClient";

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const context = await getCurrentRestaurant();
  if (!context) redirect("/login");

  const { date } = await searchParams;
  const today = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toLocalDate(new Date(), context.session.timezone);

  const admin = createAdminClient();
  const [tables, reservations] = await Promise.all([
    getActiveTables(admin, context.restaurant.id),
    getReservationsForServiceDay(admin, context.restaurant.id, today, {
      withRelations: true,
      timeZone: context.session.timezone,
    }),
  ]);

  return (
    <ReservasClient
      restaurant={context.restaurant}
      tables={tables}
      initialReservations={reservations}
      initialDate={today}
    />
  );
}
