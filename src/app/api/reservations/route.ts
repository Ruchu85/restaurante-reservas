import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { getBusinessHours, getBlockedDays, getActiveTables } from "@/lib/restaurant";
import { computeAvailableSlots, durationForParty } from "@/lib/availability";
import { getRestaurantConfig, validateReservation } from "@/lib/reservationRules";
import { setReservationTables, RESERVATION_WITH_TABLE_SELECT } from "@/lib/reservations";
import { upsertGuest } from "@/lib/guests";
import { normalizePhone } from "@/lib/phone";
import { madridDayRangeUtc, toLocalDate, dayOfWeek, addDays } from "@/lib/dates";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sendConfirmationEmail } from "@/lib/email";
import { sendConfirmationWhatsApp } from "@/lib/whatsapp";
import { z } from "zod";
import type { Reservation } from "@/types";

// ─────────────────────────────────────────────────────────
// GET /api/reservations?date=YYYY-MM-DD&party_size=N
// ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = rateLimit(`slots:${ip}`, { limit: 120, windowSeconds: 600 });
  if (!allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const partySizeStr = searchParams.get("party_size");

  if (!date || !partySizeStr) {
    return NextResponse.json({ error: "Parámetros requeridos: date, party_size" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const partySize = parseInt(partySizeStr, 10);
  if (isNaN(partySize) || partySize < 1 || partySize > 50) {
    return NextResponse.json({ error: "party_size inválido" }, { status: 400 });
  }

  const restaurantId = await getRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const admin = createAdminClient();
  const config = await getRestaurantConfig(admin, restaurantId);

  if (partySize > config.maxPartySize) {
    return NextResponse.json({
      slots: [],
      message: "Para grupos grandes, por favor llámenos.",
    });
  }

  // Ventana de reserva permitida, en el día natural del restaurante.
  const today = toLocalDate(new Date(), config.timezone);
  if (date < today) return NextResponse.json({ slots: [] });
  if (date > addDays(today, config.maxAdvanceDays)) {
    return NextResponse.json({
      slots: [],
      message: `Solo se admiten reservas con ${config.maxAdvanceDays} días de antelación.`,
    });
  }

  const [businessHours, blockedDays, tables] = await Promise.all([
    getBusinessHours(admin, restaurantId),
    getBlockedDays(admin, restaurantId, date, date),
    getActiveTables(admin, restaurantId),
  ]);

  // Se cargan también las reservas de la noche anterior: una que empieza a las
  // 23:30 sigue ocupando mesa a las 00:30 del día consultado.
  const { from } = madridDayRangeUtc(addDays(date, -1), config.timezone);
  const { to } = madridDayRangeUtc(addDays(date, 1), config.timezone);
  const { data: existing } = await admin
    .from("reservations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", from)
    .lt("starts_at", to);

  const dayHours = businessHours.find((h) => h.day_of_week === dayOfWeek(date));
  const pacing = dayHours?.max_covers_per_slot ?? config.maxCoversPerSlot;

  // Antelación mínima: no ofrecer huecos que el POST luego rechazaría.
  const earliest = new Date(Date.now() + config.minAdvanceHours * 3_600_000);

  const slots = computeAvailableSlots({
    date,
    partySize,
    businessHours,
    existingReservations: (existing ?? []) as Reservation[],
    blockedDays,
    tables,
    durationMinutes: durationForParty(partySize, {
      durationMinutes: config.durationMinutes,
      largePartyThreshold: config.largePartyThreshold,
      largePartyDurationMinutes: config.largePartyDurationMinutes,
    }),
    slotIntervalMinutes: 30,
    maxCoversPerSlot: pacing,
    allowCombining: config.allowTableCombination,
    lastSeatingOffsetMinutes: config.lastSeatingOffsetMinutes,
    timeZone: config.timezone,
    now: earliest,
  });

  return NextResponse.json({
    slots: slots.map((s) => ({
      starts_at: s.starts_at.toISOString(),
      ends_at: s.ends_at.toISOString(),
      available_tables: s.available_tables,
    })),
  });
}

// ─────────────────────────────────────────────────────────
// POST /api/reservations — reserva pública
// ─────────────────────────────────────────────────────────
const BookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  starts_at: z.string().datetime(),
  party_size: z.number().int().min(1).max(50),
  guest_name: z.string().min(2).max(100).trim(),
  guest_phone: z
    .string()
    .trim()
    .regex(/^[+\d\s\-().]{6,30}$/, "Teléfono inválido"),
  guest_email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = rateLimit(`booking:${ip}`, { limit: 10, windowSeconds: 600 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
      { status: 422 },
    );
  }

  const restaurantId = await getRestaurantId();
  if (!restaurantId) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const admin = createAdminClient();
  const config = await getRestaurantConfig(admin, restaurantId);

  const startsAt = new Date(parsed.data.starts_at);
  const hoursUntil = (startsAt.getTime() - Date.now()) / 3_600_000;

  if (hoursUntil < 0) {
    return NextResponse.json({ error: "No puedes reservar en el pasado." }, { status: 422 });
  }
  if (hoursUntil < config.minAdvanceHours) {
    return NextResponse.json(
      {
        error: `Las reservas deben hacerse con al menos ${config.minAdvanceHours} hora(s) de antelación.`,
      },
      { status: 422 },
    );
  }

  // El día de servicio se deriva del instante, no del campo `date` del cliente:
  // así no se puede reservar en un día bloqueado enviando otra fecha.
  const serviceDate = toLocalDate(startsAt, config.timezone);
  if (serviceDate > addDays(toLocalDate(new Date(), config.timezone), config.maxAdvanceDays)) {
    return NextResponse.json(
      { error: `Solo se admiten reservas con ${config.maxAdvanceDays} días de antelación.` },
      { status: 422 },
    );
  }

  const guestPhone = normalizePhone(parsed.data.guest_phone);

  // Segundo límite por teléfono: el límite por IP se reinicia en cada instancia
  // serverless, así que se apoya en la base de datos, que sí es compartida.
  const recentWindow = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count: recentCount } = await admin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("guest_phone", guestPhone)
    .eq("source", "online")
    .gte("created_at", recentWindow);

  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Has hecho demasiadas reservas hoy. Llámanos y te atendemos." },
      { status: 429 },
    );
  }

  // Protección frente a no-shows reincidentes: pueden reservar, pero por
  // teléfono, para que el restaurante decida.
  if (config.blockOnlineAfterNoShows) {
    const { data: guest } = await admin
      .from("guests")
      .select("no_shows_count")
      .eq("restaurant_id", restaurantId)
      .eq("phone", guestPhone)
      .maybeSingle();

    const noShows = (guest as { no_shows_count: number } | null)?.no_shows_count ?? 0;
    if (noShows >= config.blockOnlineAfterNoShows) {
      return NextResponse.json(
        {
          error: config.phone
            ? `No podemos completar la reserva online. Llámanos al ${config.phone} y te ayudamos.`
            : "No podemos completar la reserva online. Llámanos por teléfono y te ayudamos.",
        },
        { status: 422 },
      );
    }
  }

  const check = await validateReservation({
    admin,
    restaurantId,
    config,
    startsAt,
    partySize: parsed.data.party_size,
  });

  if (!check.ok) {
    const status = check.code === "NO_TABLES" || check.code === "PACING" ? 409 : 422;
    const error =
      check.code === "PACING"
        ? "Ese horario está completo. Prueba con otra hora."
        : check.code === "PARTY_SIZE"
          ? "Para grupos grandes, por favor llámenos directamente."
          : check.error;
    return NextResponse.json({ error }, { status });
  }

  const guestEmail = parsed.data.guest_email?.trim() ? parsed.data.guest_email.trim() : null;
  const guestId = await upsertGuest(admin, {
    restaurantId,
    phone: guestPhone,
    name: parsed.data.guest_name,
    email: guestEmail,
  });

  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurantId,
      table_id: check.tables[0].id,
      guest_id: guestId,
      guest_name: parsed.data.guest_name,
      guest_phone: guestPhone,
      guest_email: guestEmail,
      party_size: parsed.data.party_size,
      starts_at: startsAt.toISOString(),
      ends_at: check.endsAt.toISOString(),
      notes: parsed.data.notes ?? null,
      source: "online",
      status: "confirmed",
    })
    .select(RESERVATION_WITH_TABLE_SELECT)
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

  const reservation = data as unknown as Reservation;

  // Si la asignación de mesas falla, la reserva recién creada se borra: dejarla
  // sin filas en `reservation_tables` sacaría sus mesas de la restricción de
  // exclusión y permitiría una doble reserva.
  let conflict = false;
  try {
    ({ conflict } = await setReservationTables(
      admin,
      reservation,
      check.tables.map((t) => t.id),
    ));
  } catch {
    await admin.from("reservations").delete().eq("id", reservation.id);
    return NextResponse.json({ error: "Error al crear la reserva." }, { status: 500 });
  }
  if (conflict) {
    await admin.from("reservations").delete().eq("id", reservation.id);
    return NextResponse.json(
      { error: "Una de las mesas se acaba de ocupar. Prueba otro horario." },
      { status: 409 },
    );
  }

  if (guestEmail) {
    void sendConfirmationEmail({
      reservation,
      restaurantName: config.name,
      restaurantPhone: config.phone,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
      timeZone: config.timezone,
    });
  }
  void sendConfirmationWhatsApp({
    reservation,
    restaurantName: config.name,
    restaurantPhone: config.phone,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    timeZone: config.timezone,
  });

  return NextResponse.json(
    {
      reservation: {
        id: reservation.id,
        confirmation_token: reservation.confirmation_token,
        starts_at: reservation.starts_at,
        ends_at: reservation.ends_at,
        guest_name: reservation.guest_name,
        party_size: reservation.party_size,
        table: reservation.table,
      },
    },
    { status: 201 },
  );
}
