-- ============================================================
-- SALONES
-- ============================================================
create table if not exists salons (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  address       text,
  phone         text,
  email         text,
  timezone      text not null default 'Europe/Madrid',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- PERFILES (extienden auth.users de Supabase)
-- ============================================================
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  salon_id      uuid references salons(id) on delete set null,
  role          text not null default 'customer' check (role in ('admin', 'staff', 'customer')),
  full_name     text,
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- PROFESIONALES
-- ============================================================
create table if not exists staff_members (
  id            uuid primary key default gen_random_uuid(),
  salon_id      uuid not null references salons(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete set null,
  display_name  text not null,
  bio           text,
  avatar_url    text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- SERVICIOS
-- ============================================================
create table if not exists services (
  id                    uuid primary key default gen_random_uuid(),
  salon_id              uuid not null references salons(id) on delete cascade,
  name                  text not null,
  description           text,
  duration_minutes      integer not null check (duration_minutes > 0),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes  integer not null default 0 check (buffer_after_minutes >= 0),
  price_cents           integer not null check (price_cents >= 0),
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- HORARIOS DEL NEGOCIO / PROFESIONAL
-- day_of_week: 0=Domingo, 1=Lunes … 6=Sábado
-- Si staff_id es null → horario del salón
-- Si staff_id tiene valor → horario específico del profesional
-- ============================================================
create table if not exists business_hours (
  id            uuid primary key default gen_random_uuid(),
  salon_id      uuid not null references salons(id) on delete cascade,
  staff_id      uuid references staff_members(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 0 and 6),
  open_time     time not null,
  close_time    time not null,
  is_open       boolean not null default true,
  unique (salon_id, staff_id, day_of_week)
);

-- ============================================================
-- DISPONIBILIDAD ESPECÍFICA DE PROFESIONAL
-- ============================================================
create table if not exists staff_availability (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid not null references staff_members(id) on delete cascade,
  day_of_week    integer not null check (day_of_week between 0 and 6),
  start_time     time not null,
  end_time       time not null,
  is_available   boolean not null default true,
  unique (staff_id, day_of_week)
);

-- ============================================================
-- AUSENCIAS / VACACIONES DE PROFESIONAL
-- ============================================================
create table if not exists staff_time_off (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff_members(id) on delete cascade,
  salon_id    uuid not null references salons(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- ============================================================
-- CITAS
-- ============================================================
create table if not exists appointments (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references salons(id) on delete cascade,
  staff_id        uuid references staff_members(id) on delete set null,
  service_id      uuid not null references services(id),
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','completed','cancelled','no_show')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- ============================================================
-- CONSTRAINT ANTI-SOLAPAMIENTO
-- Decisión: usamos EXCLUDE USING GIST con btree_gist para
-- garantizar a nivel de base de datos que no existan dos citas
-- con el mismo profesional en rangos de tiempo superpuestos
-- cuando su estado es pending o confirmed.
-- Esto complementa (no reemplaza) la validación en la app.
-- ============================================================
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed') and staff_id is not null);

-- ============================================================
-- EVENTOS DE CITA (auditoría)
-- ============================================================
create table if not exists appointment_events (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references appointments(id) on delete cascade,
  event_type       text not null,
  description      text,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_appointments_salon_date
  on appointments (salon_id, starts_at);

create index if not exists idx_appointments_staff_date
  on appointments (staff_id, starts_at);

create index if not exists idx_appointments_status
  on appointments (status);

create index if not exists idx_business_hours_salon
  on business_hours (salon_id, staff_id, day_of_week);

create index if not exists idx_staff_time_off_staff
  on staff_time_off (staff_id, starts_at, ends_at);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger salons_updated_at
  before update on salons
  for each row execute function update_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger staff_members_updated_at
  before update on staff_members
  for each row execute function update_updated_at();

create trigger services_updated_at
  before update on services
  for each row execute function update_updated_at();

create trigger appointments_updated_at
  before update on appointments
  for each row execute function update_updated_at();
