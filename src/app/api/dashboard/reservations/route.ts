import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { toMadridDate } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();

  let q = admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, capacity, section)")
    .eq("restaurant_id", restaurantId ?? "")
    .order("starts_at");

  if (date) {
    q = q
      .gte("starts_at", date + "T00:00:00.000Z")
      .lte("starts_at", date + "T23:59:59.999Z");
  } else if (from && to) {
    q = q.gte("starts_at", from + "T00:00:00.000Z").lte("starts_at", to + "T23:59:59.999Z");
  }

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reservations: data });
}
