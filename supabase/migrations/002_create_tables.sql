-- ============================================================
-- SALONES
-- ============================================================
create table if not exists salons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  address     text,
  phone       text,
  email       text,
  timezone    text not null default 'Europe/Madrid',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- PERFILES (extienden auth.users de Supabase)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  salon_id    uuid references salons(id) on delete set null,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- PROFESIONALES
-- ============================================================
create table if not exists staff_members (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  profile_id  uuid references profiles(id) on delete set null,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- HORARIOS DEL NEGOCIO
-- day_of_week: 0=Domingo, 1=Lunes … 6=Sábado
-- ============================================================
create table if not exists business_hours (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  opens_at    time not null,
  closes_at   time not null,
  is_open     boolean not null default true,
  unique (salon_id, day_of_week)
);

-- ============================================================
-- DÍAS BLOQUEADOS (cierres, vacaciones)
-- ============================================================
create table if not exists blocked_days (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references salons(id) on delete cascade,
  date        date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (salon_id, date)
);

-- ============================================================
-- CITAS
-- status: active (vigente) | cancelled (cancelada)
-- ============================================================
create table if not exists appointments (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references salons(id) on delete cascade,
  staff_id        uuid references staff_members(id) on delete set null,
  customer_name   text not null,
  service         text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  notes           text,
  status          text not null default 'active'
                  check (status in ('active', 'cancelled')),
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- ============================================================
-- CONSTRAINT ANTI-SOLAPAMIENTO
-- Garantiza a nivel de BD que no existan dos citas activas
-- con el mismo profesional en rangos de tiempo superpuestos.
-- Usa EXCLUDE USING GIST con btree_gist (ver decisions.md).
-- ============================================================
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'active' and staff_id is not null);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_appointments_salon_date
  on appointments (salon_id, starts_at);

create index if not exists idx_appointments_staff_date
  on appointments (staff_id, starts_at);

create index if not exists idx_appointments_status
  on appointments (status);

create index if not exists idx_blocked_days_salon
  on blocked_days (salon_id, date);

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
