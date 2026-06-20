import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import {
  getBusinessHours,
  getBlockedDays,
  getActiveTables,
} from "@/lib/restaurant";
import {
  computeAvailableSlots,
  findBestTable,
  isWithinBusinessHours,
} from "@/lib/availability";
import { addMinutes } from "@/lib/utils";
import { z } from "zod";

// GET /api/reservations?date=YYYY-MM-DD&party_size=N
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const partySizeStr = searchParams.get("party_size");

  if (!date || !partySizeStr) {
    return NextResponse.json({ error: "Parámetros requeridos: date, party_size" }, { status: 400 });
  }

  const partySize = parseInt(partySizeStr, 10);
  if (isNaN(partySize) || partySize < 1) {
    return NextResponse.json({ error: "party_size inválido" }, { status: 400 });
  }

  const restaurantId = await getRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const admin = createAdminClient();

  const [businessHours, blockedDays, tables, restaurantData] = await Promise.all([
    getBusinessHours(restaurantId),
    getBlockedDays(restaurantId, date, date),
    getActiveTables(restaurantId),
    admin.from("restaurants").select("reservation_duration_minutes, max_party_size").eq("id", restaurantId).single(),
  ]);

  const restaurant = restaurantData.data as { reservation_duration_minutes: number; max_party_size: number } | null;

  if (partySize > (restaurant?.max_party_size ?? 10)) {
    return NextResponse.json({ slots: [], message: "Para grupos grandes, por favor llámenos." });
  }

  // Get existing reservations for the date
  const { data: existing } = await admin
    .from("reservations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", date + "T00:00:00.000Z")
    .lte("starts_at", date + "T23:59:59.999Z");

  const slots = computeAvailableSlots({
    date,
    partySize,
    businessHours,
    existingReservations: (existing ?? []) as Parameters<typeof computeAvailableSlots>[0]["existingReservations"],
    blockedDays,
    tables,
    durationMinutes: restaurant?.reservation_duration_minutes ?? 90,
    slotIntervalMinutes: 30,
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      starts_at: s.starts_at.toISOString(),
      ends_at: s.ends_at.toISOString(),
      available_tables: s.available_tables,
    })),
  });
}

// POST /api/reservations — public booking
const BookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  starts_at: z.string().datetime(),
  party_size: z.number().int().min(1).max(50),
  guest_name: z.string().min(2).max(100),
  guest_phone: z.string().min(6).max(30),
  guest_email: z.string().email().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const restaurantId = await getRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const admin = createAdminClient();

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("reservation_duration_minutes, min_advance_hours, max_party_size")
    .eq("id", restaurantId)
    .single();

  const r = restaurant as {
    reservation_duration_minutes: number;
    min_advance_hours: number;
    max_party_size: number;
  } | null;

  const startsAt = new Date(parsed.data.starts_at);
  const endsAt = addMinutes(startsAt, r?.reservation_duration_minutes ?? 90);
  const now = new Date();
  const hoursUntil = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < (r?.min_advance_hours ?? 1)) {
    return NextResponse.json(
      { error: `Las reservas deben hacerse con al menos ${r?.min_advance_hours ?? 1} hora(s) de antelación.` },
      { status: 422 },
    );
  }

  if (parsed.data.party_size > (r?.max_party_size ?? 10)) {
    return NextResponse.json(
      { error: "Para grupos grandes, por favor llámenos directamente." },
      { status: 422 },
    );
  }

  // Validate business hours and blocked days
  const [businessHours, blocked, tables, existing] = await Promise.all([
    getBusinessHours(restaurantId),
    admin.from("blocked_days").select("id").eq("restaurant_id", restaurantId).eq("date", parsed.data.date).maybeSingle(),
    getActiveTables(restaurantId),
    admin
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .gte("starts_at", parsed.data.date + "T00:00:00.000Z")
      .lte("starts_at", parsed.data.date + "T23:59:59.999Z"),
  ]);

  if (blocked.data) {
    return NextResponse.json({ error: "El restaurante está cerrado ese día." }, { status: 422 });
  }

  if (!isWithinBusinessHours(startsAt, endsAt, businessHours)) {
    return NextResponse.json(
      { error: "La hora seleccionada está fuera del horario del restaurante." },
      { status: 422 },
    );
  }

  const reservationsForDay = (existing.data ?? []) as Parameters<typeof findBestTable>[1];
  const bestTable = findBestTable(tables, reservationsForDay, parsed.data.party_size, startsAt, endsAt);

  if (!bestTable) {
    return NextResponse.json(
      { error: "No hay mesas disponibles para esa hora. Prueba otro horario." },
      { status: 409 },
    );
  }

  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurantId,
      table_id: bestTable.id,
      guest_name: parsed.data.guest_name,
      guest_phone: parsed.data.guest_phone,
      guest_email: parsed.data.guest_email ?? null,
      party_size: parsed.data.party_size,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      notes: parsed.data.notes ?? null,
      source: "online",
      status: "confirmed",
    })
    .select("id, confirmation_token, starts_at, ends_at, guest_name, party_size, table_id")
    .single();

  if (error) {
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "La mesa ya fue reservada. Por favor elige otro horario." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Error al crear la reserva." }, { status: 500 });
  }

  return NextResponse.json({ reservation: data }, { status: 201 });
}
