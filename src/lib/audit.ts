import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffSession } from "@/lib/auth";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Registro de auditoría.
 *
 * En una sala con varios turnos, "¿quién canceló esta reserva?" es una pregunta
 * real y frecuente. Se escribe en best-effort: un fallo al auditar nunca debe
 * tumbar la operación que el usuario acaba de hacer.
 */
export async function logAudit(
  admin: Admin,
  session: Pick<StaffSession, "userId" | "fullName" | "restaurantId"> | null,
  entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (!session) return;
  try {
    await admin.from("audit_log").insert({
      restaurant_id: session.restaurantId,
      actor_id: session.userId,
      actor_name: session.fullName,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch {
    // Best-effort: la auditoría no bloquea la operación de negocio.
  }
}
