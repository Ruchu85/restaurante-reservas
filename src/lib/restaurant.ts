import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { getStaffSession, type StaffSession } from "@/lib/auth";
import type { Restaurant, BusinessHours, BlockedDay, RestaurantTable } from "@/types";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Restaurante de la sesión activa.
 *
 * Las páginas del dashboard deben usar esto —nunca el slug del entorno—, para
 * que un usuario solo pueda ver los datos de su propio restaurante.
 */
export async function getCurrentRestaurant(): Promise<{
  session: StaffSession;
  restaurant: Restaurant;
} | null> {
  const session = await getStaffSession();
  if (!session) return null;

  const restaurant = await getRestaurantById(session.restaurantId);
  if (!restaurant) return null;

  return { session, restaurant };
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("restaurants").select("*").eq("id", id).maybeSingle();
  return (data as Restaurant | null) ?? null;
}

/**
 * Restaurante público, resuelto por el slug del entorno.
 * Solo para las páginas públicas de reserva, donde no hay sesión.
 */
export async function getRestaurant(): Promise<Restaurant | null> {
  const id = await getRestaurantId();
  if (!id) return null;
  return getRestaurantById(id);
}

/**
 * Los lectores reciben el cliente admin en lugar de construir el suyo: así se
 * reutiliza una sola conexión por petición y la lógica que los usa es
 * testeable con un doble.
 */
export async function getBusinessHours(
  admin: Admin,
  restaurantId: string,
): Promise<BusinessHours[]> {
  const { data } = await admin
    .from("business_hours")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week");
  return (data ?? []) as BusinessHours[];
}

export async function getBlockedDays(
  admin: Admin,
  restaurantId: string,
  from?: string,
  to?: string,
): Promise<BlockedDay[]> {
  let q = admin
    .from("blocked_days")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("date");
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data } = await q;
  return (data ?? []) as BlockedDay[];
}

export async function getActiveTables(
  admin: Admin,
  restaurantId: string,
): Promise<RestaurantTable[]> {
  const { data } = await admin
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .order("sort_order");
  return (data ?? []) as RestaurantTable[];
}
