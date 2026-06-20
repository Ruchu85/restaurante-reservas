export type ReservationStatus = "confirmed" | "seated" | "completed" | "no_show" | "cancelled";
export type ReservationSource = "online" | "phone" | "admin";
export type TableSection = "interior" | "terraza" | "barra" | "privado" | "sala_vip";
export type WaitlistStatus = "waiting" | "notified" | "seated" | "removed";

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
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

export interface Reservation {
  id: string;
  restaurant_id: string;
  table_id: string | null;
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
