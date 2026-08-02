import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { PUBLIC_RESERVATION_SELECT } from "@/lib/reservations";
import { sendCancellationEmail } from "@/lib/email";
import type { Reservation } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El token es la única credencial de la página pública de la reserva, así que
 * se limita el ritmo por IP para que no se pueda barrer el espacio de tokens.
 */
function guard(request: NextRequest, token: string, limit: number) {
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }
  const { allowed } = rateLimit(`token:${getClientIp(request)}`, { limit, windowSeconds: 600 });
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
  }
  return null;
}

// GET /api/reservations/:token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const blocked = guard(request, token, 60);
  if (blocked) return blocked;

  const admin = createAdminClient();
  // Lista blanca: `internal_notes` son notas privadas del equipo de sala y no
  // deben salir nunca por un endpoint público.
  const { data } = await admin
    .from("reservations")
    .select(PUBLIC_RESERVATION_SELECT)
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ reservation: data });
}

// DELETE /api/reservations/:token — cancelación por el cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const blocked = guard(request, token, 20);
  if (blocked) return blocked;

  const admin = createAdminClient();

  const { data: reservation } = await admin
    .from("reservations")
    .select("*")
    .eq("confirmation_token", token)
    .maybeSingle();

  const r = reservation as Reservation | null;
  if (!r) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }
  if (r.status === "cancelled") {
    return NextResponse.json({ error: "La reserva ya está cancelada." }, { status: 400 });
  }

  const hoursUntil = (new Date(r.starts_at).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < 2) {
    return NextResponse.json(
      { error: "No se puede cancelar con menos de 2 horas de antelación. Llámanos por teléfono." },
      { status: 422 },
    );
  }

  const { error } = await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", r.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo cancelar la reserva." }, { status: 500 });
  }

  if (r.guest_email) {
    const { data: rest } = await admin
      .from("restaurants")
      .select("name, timezone")
      .eq("id", r.restaurant_id)
      .maybeSingle();

    const restaurant = rest as { name: string; timezone: string | null } | null;

    void sendCancellationEmail({
      reservation: { ...r, status: "cancelled" },
      restaurantName: restaurant?.name ?? "Restaurante",
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
      timeZone: restaurant?.timezone ?? undefined,
    });
  }

  return NextResponse.json({ success: true });
}
