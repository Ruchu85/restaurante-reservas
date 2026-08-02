import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachTableIds, RESERVATION_SELECT } from "@/lib/reservations";
import { madridDayRangeUtc, madridRangeUtc } from "@/lib/dates";
import type { Reservation } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["confirmed", "seated", "completed", "no_show", "cancelled"];

export async function GET(request: NextRequest) {
  // El restaurante sale del perfil del usuario, nunca de un parámetro:
  // así un usuario no puede leer las reservas de otro restaurante.
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  if (date && !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  let q = admin
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("restaurant_id", session.restaurantId)
    .order("starts_at");

  // Ventanas basadas en el día natural de Europe/Madrid, no en el día UTC.
  if (date) {
    const range = madridDayRangeUtc(date, session.timezone);
    q = q.gte("starts_at", range.from).lt("starts_at", range.to);
  } else if (from && to) {
    const range = madridRangeUtc(from, to, session.timezone);
    q = q.gte("starts_at", range.from).lt("starts_at", range.to);
  }

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Error al cargar las reservas" }, { status: 500 });

  const reservations = await attachTableIds(admin, (data ?? []) as unknown as Reservation[]);
  return NextResponse.json({ reservations });
}
