import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReservationsForCalendar } from "@/lib/reservations";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reservas de un rango, para el calendario del panel.
 *
 * Existe aparte de `/api/dashboard/reservations` porque aquella devuelve la
 * ficha del comensal y todos los campos de la reserva —incluido el token de
 * cancelación—, y el calendario no usa nada de eso: aquí se comparte la misma
 * consulta ligera que usa la carga inicial de la página.
 *
 * El calendario ya no trae cuatro meses de golpe, sino el mes que se está
 * viendo; cuando el usuario cambia de mes, el cliente pide el nuevo por aquí.
 */
export async function GET(request: NextRequest) {
  // El restaurante sale del perfil del usuario, nunca de un parámetro: así un
  // usuario no puede leer las reservas de otro restaurante.
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta || !FECHA.test(desde) || !FECHA.test(hasta)) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  // Un rango abierto dejaría pedir años enteros en una sola llamada, que es
  // justo lo que este cambio venía a evitar.
  if (hasta < desde || (Date.parse(hasta) - Date.parse(desde)) / 86_400_000 > 120) {
    return NextResponse.json({ error: "Rango demasiado amplio" }, { status: 400 });
  }

  const reservations = await getReservationsForCalendar(
    createAdminClient(),
    session.restaurantId,
    desde,
    hasta,
    session.timezone,
  );

  return NextResponse.json({ reservations });
}
