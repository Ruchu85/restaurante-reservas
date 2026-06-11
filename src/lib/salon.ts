import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { SALON_INFO } from "@/lib/salonConfig";
import type { SalonInfo } from "@/lib/printTicket";
import type { Salon } from "@/types";

/**
 * Carga la fila completa del salón desde la BD.
 * Es resiliente a columnas que aún no existan en producción (capacidad,
 * datos fiscales): si la consulta amplia falla, reintenta con columnas base.
 */
export async function getSalon(): Promise<Salon | null> {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  if (!salonId) return null;

  const { data, error } = await admin
    .from("salons")
    .select("*")
    .eq("id", salonId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Salon;
}

/**
 * Capacidad de clientes simultáneos por tramo (1 por defecto).
 * Acepta opcionalmente la capacidad específica de un día de la semana.
 */
export function resolveCapacity(
  salon: Pick<Salon, "slot_capacity"> | null,
  dayCapacity?: number | null,
): number {
  const cap = dayCapacity ?? salon?.slot_capacity ?? 1;
  return cap > 0 ? cap : 1;
}

/**
 * Datos del salón para imprimir tickets. Usa la BD si está configurada,
 * con respaldo en los valores por defecto de salonConfig.
 */
export function salonToTicketInfo(salon: Salon | null): SalonInfo {
  if (!salon) return SALON_INFO;
  return {
    name: salon.name || SALON_INFO.name,
    owner: salon.owner ?? SALON_INFO.owner,
    nif: salon.nif ?? SALON_INFO.nif,
    address: salon.address ?? SALON_INFO.address,
    phone: salon.phone ?? SALON_INFO.phone,
    city: salon.city ?? SALON_INFO.city,
  };
}
