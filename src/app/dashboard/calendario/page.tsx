import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { toMadridDate } from "@/lib/utils";
import { CalendarClient } from "./CalendarClient";
import type { Reservation } from "@/types";

export const metadata = { title: "Calendario de Reservas" };

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: paramDate } = await searchParams;
  const today = paramDate ?? toMadridDate(new Date());

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();

  // Load ±45 days for calendar navigation
  const center = new Date(today + "T12:00:00");
  const from = new Date(center);
  from.setDate(center.getDate() - 45);
  const to = new Date(center);
  to.setDate(center.getDate() + 45);

  const { data: reservations } = await admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, section)")
    .eq("restaurant_id", restaurantId ?? "")
    .gte("starts_at", from.toISOString().split("T")[0] + "T00:00:00.000Z")
    .lte("starts_at", to.toISOString().split("T")[0] + "T23:59:59.999Z")
    .in("status", ["confirmed", "seated", "completed"])
    .order("starts_at");

  return (
    <CalendarClient
      initialReservations={(reservations ?? []) as Reservation[]}
      today={today}
    />
  );
}
