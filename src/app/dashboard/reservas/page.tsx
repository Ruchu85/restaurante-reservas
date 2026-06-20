import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { getRestaurant, getActiveTables } from "@/lib/restaurant";
import { ReservasClient } from "./ReservasClient";
import type { Reservation } from "@/types";

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = date ?? new Date().toISOString().split("T")[0];

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  const [restaurant, tables] = await Promise.all([
    getRestaurant(),
    getActiveTables(restaurantId ?? ""),
  ]);

  const { data: reservations } = await admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, capacity, section)")
    .eq("restaurant_id", restaurantId ?? "")
    .gte("starts_at", today + "T00:00:00.000Z")
    .lte("starts_at", today + "T23:59:59.999Z")
    .order("starts_at");

  return (
    <ReservasClient
      restaurant={restaurant!}
      tables={tables}
      initialReservations={(reservations ?? []) as Reservation[]}
      initialDate={today}
    />
  );
}
