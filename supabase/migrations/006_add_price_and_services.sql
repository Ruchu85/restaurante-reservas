-- Add price column to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS price numeric(10,2);

-- Services table for configurable service types
CREATE TABLE IF NOT EXISTS services (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references salons(id) on delete cascade,
  name             text not null,
  price            numeric(10,2),
  duration_minutes integer,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (salon_id, name)
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_services"
  ON services FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_services"
  ON services FOR ALL TO authenticated USING (true);
