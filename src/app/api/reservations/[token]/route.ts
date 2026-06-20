import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { sendCancellationEmail } from "@/lib/email";
import type { Reservation } from "@/types";

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
    .select("id, status, starts_at, guest_name, guest_email, guest_phone, party_size, ends_at, confirmation_token, restaurant_id, table_id, notes, internal_notes, source, created_at, updated_at")
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

  // Send cancellation email (best-effort)
  if (reservation.guest_email) {
    const restaurantId = await getRestaurantId();
    if (restaurantId) {
      const { data: rest } = await admin.from("restaurants").select("name").eq("id", restaurantId).single();
      const restaurantName = (rest as { name: string } | null)?.name ?? "Restaurante";

      void sendCancellationEmail({
        reservation: { ...reservation, status: "cancelled" } as Reservation,
        restaurantName,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
      });
    }
  }

  return NextResponse.json({ success: true });
}
