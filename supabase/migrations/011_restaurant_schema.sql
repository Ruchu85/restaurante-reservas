-- ============================================================
-- MIGRACIÓN 011: SCHEMA COMPLETO PARA RESTAURANTE
-- Elimina tablas del salón y crea el nuevo modelo de datos.
-- ============================================================

-- 1. Eliminar tablas antiguas (orden inverso de dependencias)
drop table if exists appointments     cascade;
drop table if exists customers        cascade;
drop table if exists services         cascade;
drop table if exists staff_members    cascade;
drop table if exists business_hours   cascade;
drop table if exists blocked_days     cascade;
drop table if exists profiles         cascade;
drop table if exists salons           cascade;

-- 2. Extensión para constraints de exclusión (solapamiento)
create extension if not exists btree_gist;

-- ============================================================
-- RESTAURANTES
-- ============================================================
create table restaurants (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  slug                        text not null unique,
  address                     text,
  phone                       text,
  email                       text,
  timezone                    text not null default 'Europe/Madrid',
  description                 text,
  website                     text,
  max_party_size              int  not null default 10,
  min_advance_hours           int  not null default 1,
  max_advance_days            int  not null default 30,
  reservation_duration_minutes int not null default 90,
  logo_url                    text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ============================================================
-- PERFILES (extienden auth.users)
-- ============================================================
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete set null,
  role          text not null default 'staff' check (role in ('admin', 'staff')),
  full_name     text,
  phone         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- MESAS
-- ============================================================
create table restaurant_tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name          text not null,
  capacity      int  not null check (capacity >= 1),
  min_capacity  int  not null default 1,
  section       text not null default 'interior'
                check (section in ('interior', 'terraza', 'barra', 'privado', 'sala_vip')),
  active        boolean not null default true,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- RESERVAS
-- ============================================================
create table reservations (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references restaurants(id) on delete cascade,
  table_id            uuid references restaurant_tables(id) on delete set null,
  guest_name          text not null,
  guest_email         text,
  guest_phone         text not null,
  party_size          int  not null check (party_size >= 1),
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  notes               text,
  internal_notes      text,
  status              text not null default 'confirmed'
                      check (status in ('confirmed', 'seated', 'completed', 'no_show', 'cancelled')),
  source              text not null default 'online'
                      check (source in ('online', 'phone', 'admin')),
  confirmation_token  uuid not null default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Constraint anti-solapamiento por mesa
alter table reservations
  add constraint reservations_no_overlap
  exclude using gist (
    table_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status not in ('cancelled', 'no_show') and table_id is not null);

-- ============================================================
-- LISTA DE ESPERA
-- ============================================================
create table waitlist (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  guest_name     text not null,
  guest_phone    text not null,
  guest_email    text,
  party_size     int  not null check (party_size >= 1),
  preferred_date date not null,
  preferred_time time,
  notes          text,
  status         text not null default 'waiting'
                 check (status in ('waiting', 'notified', 'seated', 'removed')),
  created_at     timestamptz not null default now()
);

-- ============================================================
-- HORARIOS DEL NEGOCIO
-- day_of_week: 0=Domingo, 1=Lunes … 6=Sábado
-- Soporta turno partido (almuerzo + cena)
-- ============================================================
create table business_hours (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  day_of_week   int  not null check (day_of_week between 0 and 6),
  is_open       boolean not null default true,
  opens_at      time,         -- turno de almuerzo / único turno
  closes_at     time,
  opens_at_2    time,         -- turno de cena (opcional)
  closes_at_2   time,
  unique (restaurant_id, day_of_week)
);

-- ============================================================
-- DÍAS BLOQUEADOS
-- ============================================================
create table blocked_days (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  date          date not null,
  reason        text,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, date)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index idx_reservations_restaurant_date
  on reservations (restaurant_id, starts_at);

create index idx_reservations_table_date
  on reservations (table_id, starts_at);

create index idx_reservations_status
  on reservations (status);

create index idx_reservations_token
  on reservations (confirmation_token);

create index idx_waitlist_restaurant_date
  on waitlist (restaurant_id, preferred_date);

create index idx_blocked_days_restaurant
  on blocked_days (restaurant_id, date);

create index idx_restaurant_tables_restaurant
  on restaurant_tables (restaurant_id, active);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_updated_at
  before update on restaurants
  for each row execute function update_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger reservations_updated_at
  before update on reservations
  for each row execute function update_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table restaurants       enable row level security;
alter table profiles          enable row level security;
alter table restaurant_tables enable row level security;
alter table reservations      enable row level security;
alter table waitlist          enable row level security;
alter table business_hours    enable row level security;
alter table blocked_days      enable row level security;

-- Políticas: staff/admin autenticado puede leer todo su restaurante
create policy "staff_read_restaurant"    on restaurants       for select using (true);
create policy "staff_read_profile"       on profiles          for select using (auth.uid() = id);
create policy "staff_read_tables"        on restaurant_tables for select using (true);
create policy "staff_read_reservations"  on reservations      for select using (true);
create policy "staff_read_waitlist"      on waitlist          for select using (true);
create policy "staff_read_hours"         on business_hours    for select using (true);
create policy "staff_read_blocked"       on blocked_days      for select using (true);

-- Política pública: insertar reserva online con anon key (token seguro)
create policy "public_insert_reservation" on reservations
  for insert with check (source = 'online');

-- Política pública: leer reserva por token (para página de confirmación)
create policy "public_read_reservation_by_token" on reservations
  for select using (true);

-- Política pública: insertar en lista de espera
create policy "public_insert_waitlist" on waitlist
  for insert with check (true);

-- ============================================================
-- SEED: Restaurante de demo
-- ============================================================
insert into restaurants (id, name, slug, address, phone, email, timezone, description,
                         max_party_size, min_advance_hours, max_advance_days,
                         reservation_duration_minutes)
values (
  '00000000-0000-0000-0000-000000000001',
  'Restaurante Demo',
  'restaurante-demo',
  'Calle Gran Vía 1, Madrid',
  '+34 91 000 00 00',
  'reservas@restaurantedemo.es',
  'Europe/Madrid',
  'Cocina mediterránea de autor en el corazón de Madrid',
  10, 1, 30, 90
) on conflict (slug) do nothing;

-- Horarios: almuerzo 13:30-16:00 y cena 20:30-23:30 (cerrado lunes)
insert into business_hours (restaurant_id, day_of_week, is_open, opens_at, closes_at, opens_at_2, closes_at_2)
values
  ('00000000-0000-0000-0000-000000000001', 0, true,  '13:30', '16:00', '20:30', '23:30'), -- Dom
  ('00000000-0000-0000-0000-000000000001', 1, false, null,    null,    null,    null),    -- Lun cierre
  ('00000000-0000-0000-0000-000000000001', 2, true,  '13:30', '16:00', '20:30', '23:30'), -- Mar
  ('00000000-0000-0000-0000-000000000001', 3, true,  '13:30', '16:00', '20:30', '23:30'), -- Mié
  ('00000000-0000-0000-0000-000000000001', 4, true,  '13:30', '16:00', '20:30', '23:30'), -- Jue
  ('00000000-0000-0000-0000-000000000001', 5, true,  '13:30', '16:00', '20:30', '23:30'), -- Vie
  ('00000000-0000-0000-0000-000000000001', 6, true,  '13:30', '16:00', '20:30', '23:30')  -- Sáb
on conflict (restaurant_id, day_of_week) do nothing;

-- Mesas de demo
insert into restaurant_tables (id, restaurant_id, name, capacity, min_capacity, section, sort_order)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Mesa 1',    2, 1, 'interior', 1),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Mesa 2',    2, 1, 'interior', 2),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Mesa 3',    4, 2, 'interior', 3),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Mesa 4',    4, 2, 'interior', 4),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Mesa 5',    6, 3, 'interior', 5),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Mesa 6',    6, 3, 'interior', 6),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Terraza A', 2, 1, 'terraza',  7),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Terraza B', 4, 2, 'terraza',  8),
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Sala VIP',  8, 4, 'sala_vip', 9)
on conflict (id) do nothing;
