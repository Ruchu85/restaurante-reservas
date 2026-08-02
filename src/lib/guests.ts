import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import type { Guest } from "@/types";

/**
 * CRM de comensales.
 *
 * Cada reserva se vincula a una ficha de comensal identificada por
 * (restaurant_id, teléfono normalizado). Los contadores de visitas, no-shows y
 * cancelaciones los mantiene un trigger en la base de datos, así que aquí solo
 * hay que crear/actualizar la ficha y devolver su id.
 */

type Admin = ReturnType<typeof createAdminClient>;

export interface UpsertGuestInput {
  restaurantId: string;
  phone: string;
  name: string;
  email?: string | null;
}

/**
 * Crea la ficha del comensal o actualiza sus datos de contacto si ya existe.
 * Nunca sobrescribe notas, alérgenos ni etiquetas: eso lo gestiona la sala.
 */
export async function upsertGuest(
  admin: Admin,
  input: UpsertGuestInput,
): Promise<string | null> {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const { data: existing } = await admin
    .from("guests")
    .select("id, name, email")
    .eq("restaurant_id", input.restaurantId)
    .eq("phone", phone)
    .maybeSingle();

  const current = existing as { id: string; name: string; email: string | null } | null;

  if (current) {
    const patch: Record<string, string> = {};
    // El nombre más reciente suele ser el bueno (p. ej. corrección de errata).
    if (input.name && input.name !== current.name) patch.name = input.name;
    // El email solo se rellena si faltaba: no perdemos uno bueno por una reserva sin email.
    if (input.email && !current.email) patch.email = input.email;
    if (Object.keys(patch).length > 0) {
      await admin.from("guests").update(patch).eq("id", current.id);
    }
    return current.id;
  }

  const { data: created, error } = await admin
    .from("guests")
    .insert({
      restaurant_id: input.restaurantId,
      phone,
      name: input.name,
      email: input.email ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = violación de la clave única (restaurant_id, phone): otra reserva
    // simultánea creó la ficha primero, así que la releemos.
    // Cualquier otro error es un fallo real y no debe silenciarse.
    if (error.code !== "23505") {
      throw new Error(`No se pudo crear la ficha del comensal: ${error.code}`);
    }
    const { data: retry } = await admin
      .from("guests")
      .select("id")
      .eq("restaurant_id", input.restaurantId)
      .eq("phone", phone)
      .maybeSingle();
    return (retry as { id: string } | null)?.id ?? null;
  }

  return (created as { id: string }).id;
}

/** Ficha completa del comensal. */
export async function getGuest(
  admin: Admin,
  restaurantId: string,
  guestId: string,
): Promise<Guest | null> {
  const { data } = await admin
    .from("guests")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", guestId)
    .maybeSingle();
  return (data as Guest | null) ?? null;
}

/**
 * Sanea el término de búsqueda para el lenguaje de filtros de PostgREST.
 *
 * `.or()` recibe una cadena con gramática propia: una coma o un paréntesis en
 * la entrada del usuario añade condiciones arbitrarias al filtro. También se
 * neutralizan los comodines de `ilike` para que la búsqueda haga lo que el
 * usuario espera.
 */
function sanitizeSearchTerm(value: string): string {
  return value.replace(/[,()*%\\.:"']/g, " ").replace(/\s+/g, " ").trim();
}

/** Busca comensales por nombre, teléfono o email. */
export async function searchGuests(
  admin: Admin,
  restaurantId: string,
  query: string,
  limit = 20,
  offset = 0,
): Promise<Guest[]> {
  const safe = sanitizeSearchTerm(query);
  if (safe.length < 2) return [];

  const digits = normalizePhone(query).replace(/\D/g, "");
  const filters = [`name.ilike.%${safe}%`, `email.ilike.%${safe}%`];
  if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);

  const { data } = await admin
    .from("guests")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .or(filters.join(","))
    .order("visits_count", { ascending: false })
    .range(offset, offset + limit - 1);

  return (data ?? []) as Guest[];
}

/** Número total de comensales que coinciden con la búsqueda. */
export async function countGuests(
  admin: Admin,
  restaurantId: string,
  query: string,
): Promise<number> {
  const safe = sanitizeSearchTerm(query);
  if (safe.length < 2) return 0;

  const digits = normalizePhone(query).replace(/\D/g, "");
  const filters = [`name.ilike.%${safe}%`, `email.ilike.%${safe}%`];
  if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);

  const { count } = await admin
    .from("guests")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .or(filters.join(","));

  return count ?? 0;
}
