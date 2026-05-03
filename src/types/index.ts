export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Salon {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  salon_id: string | null;
  role: "admin" | "staff" | "customer";
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  salon_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  price_cents: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffMember {
  id: string;
  salon_id: string;
  profile_id: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  id: string;
  salon_id: string;
  staff_id: string | null;
  day_of_week: number; // 0=Sunday, 1=Monday...6=Saturday
  open_time: string; // HH:MM
  close_time: string; // HH:MM
  is_open: boolean;
}

export interface StaffAvailability {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface StaffTimeOff {
  id: string;
  staff_id: string;
  salon_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  salon_id: string;
  staff_id: string | null;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  service?: Service;
  staff?: StaffMember;
}

export interface AppointmentEvent {
  id: string;
  appointment_id: string;
  event_type: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TimeSlot {
  starts_at: Date;
  ends_at: Date;
  available: boolean;
  staff_id?: string;
}

export interface AvailabilityQuery {
  salon_id: string;
  service_id: string;
  staff_id?: string;
  date: string; // YYYY-MM-DD
}
