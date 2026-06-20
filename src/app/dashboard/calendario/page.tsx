import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { toMadridDate } from "@/lib/utils";
import { getBusinessHours, getBlockedDays, getActiveTables } from "@/lib/restaurant";
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
  const rid = restaurantId ?? "";

  // Load ±60 days for calendar navigation
  const center = new Date(today + "T12:00:00");
  const from = new Date(center);
  from.setDate(center.getDate() - 60);
  const to = new Date(center);
  to.setDate(center.getDate() + 60);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  const [reservationsRes, businessHours, blockedDays, tables] = await Promise.all([
    admin
      .from("reservations")
      .select("*, table:restaurant_tables(id, name, capacity, section)")
      .eq("restaurant_id", rid)
      .gte("starts_at", fromStr + "T00:00:00.000Z")
      .lte("starts_at", toStr + "T23:59:59.999Z")
      .in("status", ["confirmed", "seated", "completed"])
      .order("starts_at"),
    getBusinessHours(rid),
    getBlockedDays(rid, fromStr, toStr),
    getActiveTables(rid),
  ]);

  return (
    <CalendarClient
      initialReservations={(reservationsRes.data ?? []) as Reservation[]}
      businessHours={businessHours}
      blockedDays={blockedDays}
      tables={tables}
      today={today}
    />
  );
}
