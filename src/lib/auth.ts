import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface StaffSession {
  userId: string;
  email: string | null;
  role: "admin" | "staff";
  restaurantId: string;
  fullName: string | null;
  /** Zona horaria del restaurante. Todo lo que se muestre debe usarla. */
  timezone: string;
}

/**
 * Error devuelto por las server actions cuando no hay sesión válida.
 * Se devuelve como valor (no se lanza) para que el cliente lo muestre igual
 * que cualquier otro error de validación.
 */
export const UNAUTHORIZED = { error: "No autorizado. Inicia sesión de nuevo." } as const;
export const FORBIDDEN = { error: "No tienes permisos para esta acción." } as const;

/**
 * Resuelve la sesión del empleado a partir de la cookie de Supabase.
 *
 * IMPORTANTE: el restaurant_id se toma del perfil del usuario autenticado,
 * NUNCA de una variable de entorno o de un parámetro del cliente. Esto es lo
 * que impide que un usuario de un tenant opere sobre datos de otro.
 *
 * Devuelve null si no hay usuario, si no tiene perfil o si el perfil no está
 * asociado a ningún restaurante.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // El perfil se lee con service role: las políticas RLS de profiles son
  // restrictivas y aquí ya hemos verificado la identidad con getUser().
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("restaurant_id, role, full_name, restaurant:restaurants(timezone)")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as
    | {
        restaurant_id: string | null;
        role: "admin" | "staff";
        full_name: string | null;
        restaurant: { timezone: string | null } | { timezone: string | null }[] | null;
      }
    | null;

  if (!p?.restaurant_id) return null;

  // La relación llega como objeto o como array de uno según el cliente.
  const restaurant = Array.isArray(p.restaurant) ? p.restaurant[0] : p.restaurant;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: p.role === "admin" ? "admin" : "staff",
    restaurantId: p.restaurant_id,
    fullName: p.full_name,
    timezone: restaurant?.timezone || "Europe/Madrid",
  };
}

/** Exige sesión de empleado (staff o admin). */
export async function requireStaff(): Promise<StaffSession | null> {
  return getStaffSession();
}

/** Exige sesión de administrador. Devuelve null si no lo es. */
export async function requireAdmin(): Promise<StaffSession | null> {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") return null;
  return session;
}
