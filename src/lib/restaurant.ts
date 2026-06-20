import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import type { Restaurant, BusinessHours, BlockedDay, RestaurantTable } from "@/types";

export async function getRestaurant(): Promise<Restaurant | null> {
  const id = await getRestaurantId();
  if (!id) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .single();
  return data as Restaurant | null;
}

export async function getBusinessHours(restaurantId: string): Promise<BusinessHours[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("business_hours")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week");
  return (data ?? []) as BusinessHours[];
}

export async function getBlockedDays(
  restaurantId: string,
  from?: string,
  to?: string,
): Promise<BlockedDay[]> {
  const admin = createAdminClient();
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

export async function getActiveTables(restaurantId: string): Promise<RestaurantTable[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurant_tables")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .order("sort_order");
  return (data ?? []) as RestaurantTable[];
}
