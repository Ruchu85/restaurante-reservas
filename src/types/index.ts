export type ReservationStatus = "confirmed" | "seated" | "completed" | "no_show" | "cancelled";
export type ReservationSource = "online" | "phone" | "admin";
export type TableSection = "interior" | "terraza" | "barra" | "privado" | "sala_vip";
export type WaitlistStatus = "waiting" | "notified" | "seated" | "removed";
export type GuestTag = "vip" | "habitual" | "alergias" | "celebracion" | "prensa" | "conflictivo";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  description: string | null;
  website: string | null;
  max_party_size: number;
  min_advance_hours: number;
  max_advance_days: number;
  reservation_duration_minutes: number;
  logo_url: string | null;
  /** Pacing: máximo de comensales que pueden sentarse en la misma franja. 0/null = sin límite. */
  max_covers_per_slot: number | null;
  /** Permitir juntar mesas automáticamente para grupos grandes. */
  allow_table_combination: boolean;
  /** Minutos antes del cierre en los que se acepta la última entrada. 0 = la reserva debe caber entera. */
  last_seating_offset_minutes: number;
  /** A partir de cuántos comensales se considera grupo grande. */
  large_party_threshold: number;
  /** Duración para grupos grandes. null = usa reservation_duration_minutes. */
  large_party_duration_minutes: number | null;
  /** No-shows a partir de los cuales el comensal no puede reservar online. null = sin bloqueo. */
  block_online_after_no_shows: number | null;
  created_at: string;
  updated_at: string;
}

/** Reglas de servicio que afectan al cálculo de disponibilidad. */
export interface ServiceRules {
  durationMinutes: number;
  largePartyThreshold: number;
  largePartyDurationMinutes: number | null;
  lastSeatingOffsetMinutes: number;
  maxCoversPerSlot: number | null;
  allowTableCombination: boolean;
  maxPartySize: number;
  timezone: string;
}

export interface Profile {
  id: string;
  restaurant_id: string | null;
  role: "admin" | "staff";
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  name: string;
  capacity: number;
  min_capacity: number;
  section: TableSection;
  active: boolean;
  sort_order: number;
  /** Si la mesa puede juntarse con otras de su misma sala para grupos grandes. */
  combinable: boolean;
  created_at: string;
}

export interface Reservation {
  id: string;
  restaurant_id: string;
  /** Mesa principal. Para grupos con mesas juntadas es la primera de `table_ids`. */
  table_id: string | null;
  /** Todas las mesas asignadas (≥2 cuando el grupo ocupa mesas juntadas). */
  table_ids: string[] | null;
  guest_id: string | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  internal_notes: string | null;
  status: ReservationStatus;
  source: ReservationSource;
  confirmation_token: string;
  created_at: string;
  updated_at: string;
  // joined
  table?: Pick<RestaurantTable, "id" | "name" | "capacity" | "section">;
  guest?: Pick<Guest, "id" | "visits_count" | "no_shows_count" | "tags" | "allergies" | "notes">;
}

/**
 * Ficha de comensal (CRM). Se crea/actualiza automáticamente a partir del
 * teléfono en cada reserva, de forma que el equipo de sala reconoce al cliente
 * habitual, sus alergias y su historial de no-shows.
 */
export interface Guest {
  id: string;
  restaurant_id: string;
  /** Teléfono normalizado E.164 — clave natural del comensal. */
  phone: string;
  name: string;
  email: string | null;
  notes: string | null;
  allergies: string | null;
  tags: GuestTag[];
  visits_count: number;
  no_shows_count: number;
  cancellations_count: number;
  total_covers: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: string;
  restaurant_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  party_size: number;
  preferred_date: string;
  preferred_time: string | null;
  notes: string | null;
  status: WaitlistStatus;
  created_at: string;
}

export interface BusinessHours {
  id: string;
  restaurant_id: string;
  day_of_week: number; // 0=Domingo, 1=Lunes … 6=Sábado
  is_open: boolean;
  opens_at: string | null;    // HH:MM — turno almuerzo / único
  closes_at: string | null;
  opens_at_2: string | null;  // HH:MM — turno cena (opcional)
  closes_at_2: string | null;
  /** Pacing específico del día. Si es null, se usa el del restaurante. */
  max_covers_per_slot: number | null;
}

/** Registro de auditoría: quién cambió qué y cuándo. */
export interface AuditEntry {
  id: string;
  restaurant_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface BlockedDay {
  id: string;
  restaurant_id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
  created_at: string;
}

export interface TimeSlot {
  starts_at: Date;
  ends_at: Date;
  available: boolean;
  available_tables: number;
}

export interface DayAvailability {
  date: string;
  available: boolean;
  slots: TimeSlot[];
}

// Summary types for dashboard
export interface DailySummary {
  date: string;
  total_reservations: number;
  total_covers: number;
  confirmed: number;
  seated: number;
  completed: number;
  no_shows: number;
  cancelled: number;
}
