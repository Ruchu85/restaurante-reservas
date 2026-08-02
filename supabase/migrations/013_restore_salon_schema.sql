-- ============================================================
-- MIGRACIÓN 013: RESTAURAR ESQUEMA DEL SALÓN
-- Coexiste con el esquema del restaurante en el mismo proyecto Supabase.
-- Estrategia: tablas propias del salón se re-crean; business_hours y
-- blocked_days comparten la misma tabla añadiendo salon_id nullable.
-- ============================================================

-- ============================================================
-- 1. TABLA SALONES
-- ============================================================
create table if not exists salons (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  address        text,
  phone          text,
  email          text,
  timezone       text not null default 'Europe/Madrid',
  slot_capacity  int  not null default 1,
  owner          text,
  nif            text,
  city           text,
  ticket_footer  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- 2. TABLA PERFILES — añadir salon_id (ya existe restaurant_id)
-- ============================================================
alter table profiles
  add column if not exists salon_id uuid references salons(id) on delete set null;

-- ============================================================
-- 3. STAFF MEMBERS
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
-- 4. APPOINTMENTS
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
  price           numeric(10,2),
  ticket_number   integer,
  ticket_printed  boolean not null default false,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Anti-overlap: no dos citas activas del mismo profesional a la vez
do $$ begin
  alter table appointments add constraint appointments_no_overlap
    exclude using gist (
      staff_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
    where (status = 'active' and staff_id is not null);
exception when duplicate_object then null;
end $$;

create index if not exists idx_appointments_salon_date
  on appointments (salon_id, starts_at);
create index if not exists idx_appointments_staff_date
  on appointments (staff_id, starts_at);

-- ============================================================
-- 5. SERVICES
-- ============================================================
create table if not exists services (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references salons(id) on delete cascade,
  name             text not null,
  price            numeric(10,2),
  duration_minutes integer,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (salon_id, name)
);

-- ============================================================
-- 6. CUSTOMERS
-- ============================================================
create table if not exists customers (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references salons(id) on delete cascade,
  name              text not null,
  preferred_service text,
  phone             text,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (salon_id, name)
);

create index if not exists idx_customers_salon
  on customers (salon_id, name);

-- ============================================================
-- 7. BUSINESS_HOURS — ampliar para soportar salon_id
-- La tabla ya existe con restaurant_id. Añadimos salon_id y
-- cambiamos la restricción de unicidad a parcial para cada tipo.
-- ============================================================

-- Hacer restaurant_id nullable (actualmente NOT NULL)
alter table business_hours
  alter column restaurant_id drop not null;

-- Añadir salon_id y slot_capacity (ya presentes en schema del salón)
alter table business_hours
  add column if not exists salon_id      uuid references salons(id) on delete cascade,
  add column if not exists slot_capacity int;

-- Eliminar unique constraint original (restaurant_id, day_of_week)
-- que no funciona bien con NULLs parciales
alter table business_hours
  drop constraint if exists business_hours_restaurant_id_day_of_week_key;

-- Crear índices únicos parciales: uno por tipo de negocio
create unique index if not exists bh_restaurant_unique
  on business_hours (restaurant_id, day_of_week)
  where restaurant_id is not null;

create unique index if not exists bh_salon_unique
  on business_hours (salon_id, day_of_week)
  where salon_id is not null;

-- ============================================================
-- 8. BLOCKED_DAYS — ampliar para soportar salon_id
-- ============================================================

-- Hacer restaurant_id nullable
alter table blocked_days
  alter column restaurant_id drop not null;

-- Añadir salon_id
alter table blocked_days
  add column if not exists salon_id uuid references salons(id) on delete cascade;

-- Eliminar unique constraint original
alter table blocked_days
  drop constraint if exists blocked_days_restaurant_id_date_key;

-- Crear índices únicos parciales
create unique index if not exists bd_restaurant_unique
  on blocked_days (restaurant_id, date)
  where restaurant_id is not null;

create unique index if not exists bd_salon_unique
  on blocked_days (salon_id, date)
  where salon_id is not null;

-- ============================================================
-- 9. SECUENCIA TICKETS
-- ============================================================
create sequence if not exists ticket_number_seq start with 201;

create or replace function next_ticket_number()
returns integer language sql security definer as $$
  select nextval('ticket_number_seq')::integer;
$$;

-- ============================================================
-- 10. TRIGGERS updated_at para nuevas tablas
-- ============================================================
create or replace trigger salons_updated_at
  before update on salons
  for each row execute function update_updated_at();

create or replace trigger staff_members_updated_at
  before update on staff_members
  for each row execute function update_updated_at();

-- ============================================================
-- 11. RLS
-- ============================================================
alter table salons        enable row level security;
alter table staff_members enable row level security;
alter table appointments  enable row level security;
alter table services      enable row level security;
alter table customers     enable row level security;

-- Funciones helper para el salón (leen salon_id/role del perfil del usuario)
create or replace function auth_salon_id()
returns uuid language sql stable security definer as $$
  select salon_id from profiles where id = auth.uid()
$$;

create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- Salons
create policy "salons_member_read"
  on salons for select
  using (id = auth_salon_id());

create policy "salons_admin_update"
  on salons for update
  using (id = auth_salon_id() and auth_role() = 'admin');

-- Profiles (salon)
create policy "profiles_own_read"
  on profiles for select
  using (id = auth.uid());

create policy "profiles_own_update"
  on profiles for update
  using (id = auth.uid());

create policy "profiles_admin_read"
  on profiles for select
  using (salon_id = auth_salon_id() and auth_role() = 'admin');

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

-- Staff
create policy "staff_salon_read"
  on staff_members for select
  using (salon_id = auth_salon_id());

create policy "staff_admin_all"
  on staff_members for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- Appointments
create policy "appointments_staff_read"
  on appointments for select
  using (
    salon_id = auth_salon_id()
    and (
      auth_role() = 'admin'
      or staff_id = (
        select sm.id from staff_members sm
        where sm.profile_id = auth.uid() limit 1
      )
    )
  );

create policy "appointments_staff_insert"
  on appointments for insert
  with check (salon_id = auth_salon_id());

create policy "appointments_staff_update"
  on appointments for update
  using (
    salon_id = auth_salon_id()
    and (
      auth_role() = 'admin'
      or staff_id = (
        select sm.id from staff_members sm
        where sm.profile_id = auth.uid() limit 1
      )
    )
  );

create policy "appointments_admin_delete"
  on appointments for delete
  using (salon_id = auth_salon_id() and auth_role() = 'admin');

-- Services
create policy "services_read"
  on services for select to authenticated using (true);

create policy "services_write"
  on services for all to authenticated using (true);

-- Customers
create policy "customers_salon_read"
  on customers for select
  using (salon_id = auth_salon_id());

create policy "customers_salon_insert"
  on customers for insert
  with check (salon_id = auth_salon_id());

create policy "customers_salon_update"
  on customers for update
  using (salon_id = auth_salon_id())
  with check (salon_id = auth_salon_id());

create policy "customers_admin_delete"
  on customers for delete
  using (salon_id = auth_salon_id());

-- Business hours — políticas del salón (además de la del restaurante ya existente)
create policy "business_hours_salon_read"
  on business_hours for select
  using (salon_id = auth_salon_id());

create policy "business_hours_admin_write"
  on business_hours for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- Blocked days — políticas del salón
create policy "blocked_days_salon_read"
  on blocked_days for select
  using (salon_id = auth_salon_id());

create policy "blocked_days_admin_write"
  on blocked_days for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- 12. TRIGGER handle_new_user — multi-tenant
-- Si el usuario lleva app='salon' en metadata → perfil de salón
-- Si no → perfil de restaurante (comportamiento por defecto)
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  app_type text := new.raw_user_meta_data->>'app';
begin
  if app_type = 'salon' then
    insert into public.profiles (id, salon_id, role)
    values (new.id, '00000000-0000-0000-0000-000000000001', 'admin')
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, restaurant_id, role)
    values (new.id, '00000000-0000-0000-0000-000000000001', 'admin')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 13. SEED — datos de demo del salón
-- ============================================================

-- Salón de demo
insert into salons (id, name, slug, address, phone, email, timezone, slot_capacity)
values (
  '00000000-0000-0000-0000-000000000001',
  'Salón Demo',
  'salon-demo',
  'Calle Mayor 1, Madrid',
  '+34 600 000 000',
  'hola@salondemo.es',
  'Europe/Madrid',
  1
) on conflict (slug) do nothing;

-- Horarios del salón (Lun-Vie 9-20h, Sáb 9-14h, Dom cerrado)
insert into business_hours (salon_id, day_of_week, opens_at, closes_at, is_open)
values
  ('00000000-0000-0000-0000-000000000001', 0, '09:00', '20:00', false),
  ('00000000-0000-0000-0000-000000000001', 1, '09:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', 2, '09:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', 3, '09:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', 4, '09:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', 5, '09:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', 6, '09:00', '14:00', true)
on conflict do nothing;

-- Profesionales de demo
insert into staff_members (id, salon_id, name, active)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'María García', true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Carlos López', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Ana Martínez', true)
on conflict (id) do nothing;
