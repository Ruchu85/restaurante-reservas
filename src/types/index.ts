export type AppointmentStatus = "active" | "cancelled";

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
  role: "admin" | "staff";
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffMember {
  id: string;
  salon_id: string;
  profile_id: string | null;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  id: string;
  salon_id: string;
  day_of_week: number; // 0=Domingo, 1=Lunes … 6=Sábado
  opens_at: string;   // HH:MM
  closes_at: string;  // HH:MM
  is_open: boolean;
}

export interface BlockedDay {
  id: string;
  salon_id: string;
  date: string; // YYYY-MM-DD
  reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  salon_id: string;
  staff_id: string | null;
  customer_name: string;
  service: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  status: AppointmentStatus;
  ticket_printed: boolean;
  ticket_number: number | null;
  created_at: string;
  // joined
  staff?: Pick<StaffMember, "id" | "name">;
}

export interface TimeSlot {
  starts_at: Date;
  ends_at: Date;
  available: boolean;
  staff_id?: string;
}
