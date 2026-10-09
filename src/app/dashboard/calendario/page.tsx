import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/auth";
import { getBusinessHours, getBlockedDays, getActiveTables } from "@/lib/restaurant";
import { getReservationsForCalendar } from "@/lib/reservations";
import { toLocalDate, addDays, rangoDelMes } from "@/lib/dates";
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

  // Solo el mes que se va a ver. Antes eran ±60 días: mil reservas y 466 KB de
  // respuesta para pintar una rejilla de treinta días. Los demás meses los pide
  // el cliente conforme el usuario navega.
  const { desde, hasta } = rangoDelMes(today);

  // Los días cerrados sí se traen de par en par de años: es una fila por día
  // cerrado, pesa nada, y así al cambiar de mes los cierres ya están puestos
  // en vez de aparecer un segundo después.
  const [reservations, businessHours, blockedDays, tables] = await Promise.all([
    getReservationsForCalendar(admin, rid, desde, hasta, session.timezone),
    getBusinessHours(admin, rid),
    getBlockedDays(admin, rid, addDays(today, -365), addDays(today, 365)),
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
