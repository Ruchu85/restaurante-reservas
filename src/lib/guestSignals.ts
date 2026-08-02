import type { Guest } from "@/types";

export type SignalTone = "positive" | "warning" | "danger" | "neutral";

export interface GuestSignal {
  label: string;
  tone: SignalTone;
}

/**
 * Señales de atención del comensal, para que el equipo de sala sepa a quién
 * tiene delante sin abrir la ficha.
 *
 * Vive en su propio módulo (sin dependencias de servidor) porque lo consumen
 * componentes de cliente: si estuviera en `guests.ts` arrastraría el cliente de
 * Supabase al bundle del navegador.
 */
export function guestSignals(
  guest:
    | Pick<Guest, "visits_count" | "no_shows_count" | "tags" | "allergies">
    | null
    | undefined,
): GuestSignal[] {
  if (!guest) return [];
  const signals: GuestSignal[] = [];

  if (guest.tags?.includes("vip")) signals.push({ label: "VIP", tone: "positive" });

  if (guest.visits_count >= 10) {
    signals.push({ label: `${guest.visits_count} visitas`, tone: "positive" });
  } else if (guest.visits_count >= 3) {
    signals.push({ label: "Cliente habitual", tone: "positive" });
  }

  if (guest.allergies) {
    signals.push({ label: `Alergias: ${guest.allergies}`, tone: "warning" });
  }

  if (guest.no_shows_count >= 2) {
    signals.push({ label: `${guest.no_shows_count} no-shows`, tone: "danger" });
  } else if (guest.no_shows_count === 1) {
    signals.push({ label: "1 no-show", tone: "warning" });
  }

  if (guest.tags?.includes("celebracion")) {
    signals.push({ label: "Celebración", tone: "positive" });
  }
  if (guest.tags?.includes("prensa")) signals.push({ label: "Prensa", tone: "neutral" });
  if (guest.tags?.includes("conflictivo")) {
    signals.push({ label: "Atención especial", tone: "danger" });
  }

  return signals;
}
