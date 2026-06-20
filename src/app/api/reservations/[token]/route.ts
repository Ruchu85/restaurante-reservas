import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/reservations/:token
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, section)")
    .eq("confirmation_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ reservation: data });
}

// DELETE /api/reservations/:token — guest cancel
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, starts_at")
    .eq("confirmation_token", token)
    .single();

  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada." }, { status: 404 });
  }

  if (reservation.status === "cancelled") {
    return NextResponse.json({ error: "La reserva ya está cancelada." }, { status: 400 });
  }

  const startsAt = new Date(reservation.starts_at);
  const now = new Date();
  const hoursUntil = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < 2) {
    return NextResponse.json(
      { error: "No se puede cancelar con menos de 2 horas de antelación." },
      { status: 422 },
    );
  }

  const { error } = await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("confirmation_token", token);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
