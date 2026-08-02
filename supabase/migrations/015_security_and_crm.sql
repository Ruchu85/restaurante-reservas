-- ============================================================
-- MIGRACIÓN 015: BLINDAJE DE SEGURIDAD + CRM DE COMENSALES
--
-- A) Cierra las políticas RLS abiertas de la migración 011, que permitían a
--    cualquiera con la anon key (pública, va en el bundle del navegador)
--    leer TODAS las reservas —nombre, teléfono y email de cada cliente— e
--    insertar reservas saltándose horarios, aforo y rate limiting.
-- B) Añade el CRM de comensales, el pacing de sala, la combinación de mesas
--    y el registro de auditoría.
-- ============================================================

-- ============================================================
-- A. SEGURIDAD — RLS
-- ============================================================

-- A.1 Fuga de PII: la anon key podía leer la tabla entera de reservas.
--     La página pública de confirmación consulta por token desde el servidor
--     con service role, así que no necesita esta política.
drop policy if exists "public_read_reservation_by_token" on reservations;

-- A.2 Inserción pública directa: permitía crear reservas sin pasar por
--     /api/reservations (sin validar horario, aforo, antelación ni pacing).
drop policy if exists "public_insert_reservation" on reservations;
drop policy if exists "public_insert_waitlist"    on waitlist;

-- A.3 Políticas de lectura abiertas (`using (true)`) de la 011.
--     Las sustituye la 014 con filtro por tenant; aquí nos aseguramos de que
--     no quede ninguna suelta aunque la 014 no se haya aplicado.
drop policy if exists "staff_read_restaurant"   on restaurants;
drop policy if exists "staff_read_tables"       on restaurant_tables;
drop policy if exists "staff_read_reservations" on reservations;
drop policy if exists "staff_read_waitlist"     on waitlist;
drop policy if exists "staff_read_hours"        on business_hours;
drop policy if exists "staff_read_blocked"      on blocked_days;

-- Helper: restaurante del usuario autenticado.
create or replace function auth_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from profiles where id = auth.uid();
$$;

-- Recrear las políticas de lectura con filtro por tenant (idempotente
-- respecto a la 014: si ya existen con ese nombre, se recrean igual).
drop policy if exists "restaurants_tenant_read"       on restaurants;
drop policy if exists "restaurant_tables_tenant_read" on restaurant_tables;
drop policy if exists "reservations_tenant_read"      on reservations;
drop policy if exists "waitlist_tenant_read"          on waitlist;

create policy "restaurants_tenant_read" on restaurants
  for select using (id = auth_restaurant_id());

create policy "restaurant_tables_tenant_read" on restaurant_tables
  for select using (restaurant_id = auth_restaurant_id());

create policy "reservations_tenant_read" on reservations
  for select using (restaurant_id = auth_restaurant_id());

create policy "waitlist_tenant_read" on waitlist
  for select using (restaurant_id = auth_restaurant_id());

-- ============================================================
-- B. PACING Y COMBINACIÓN DE MESAS
-- ============================================================

alter table restaurants
  add column if not exists max_covers_per_slot     int     default null,
  add column if not exists allow_table_combination boolean not null default true;

comment on column restaurants.max_covers_per_slot is
  'Máximo de comensales que pueden sentarse en la misma franja horaria. NULL = sin límite.';

alter table business_hours
  add column if not exists max_covers_per_slot int default null;

comment on column business_hours.max_covers_per_slot is
  'Pacing específico de este día. NULL = hereda el del restaurante.';

alter table restaurant_tables
  add column if not exists combinable boolean not null default true;

comment on column restaurant_tables.combinable is
  'Si la mesa puede juntarse con otras de su misma sala para grupos grandes.';

-- ============================================================
-- C. CRM DE COMENSALES
-- ============================================================

create table if not exists guests (
  id                   uuid primary key default gen_random_uuid(),
  restaurant_id        uuid not null references restaurants(id) on delete cascade,
  phone                text not null,
  name                 text not null,
  email                text,
  notes                text,
  allergies            text,
  tags                 text[] not null default '{}',
  visits_count         int  not null default 0,
  no_shows_count       int  not null default 0,
  cancellations_count  int  not null default 0,
  total_covers         int  not null default 0,
  last_visit_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (restaurant_id, phone)
);

create index if not exists idx_guests_restaurant_phone on guests (restaurant_id, phone);
create index if not exists idx_guests_restaurant_name  on guests (restaurant_id, lower(name));

alter table reservations
  add column if not exists guest_id uuid references guests(id) on delete set null;

create index if not exists idx_reservations_guest on reservations (guest_id);

drop trigger if exists guests_updated_at on guests;
create trigger guests_updated_at
  before update on guests
  for each row execute function update_updated_at();

alter table guests enable row level security;

drop policy if exists "guests_tenant_read" on guests;
create policy "guests_tenant_read" on guests
  for select using (restaurant_id = auth_restaurant_id());

-- ------------------------------------------------------------
-- Mantenimiento automático de los contadores del comensal.
-- Se recalculan desde las reservas en cada cambio de estado, de modo que
-- son siempre consistentes aunque se corrija una reserva a posteriori.
-- ------------------------------------------------------------
create or replace function refresh_guest_stats(p_guest_id uuid)
returns void
language plpgsql
as $$
begin
  if p_guest_id is null then
    return;
  end if;

  update guests g
  set visits_count        = s.visits,
      no_shows_count      = s.no_shows,
      cancellations_count = s.cancellations,
      total_covers        = s.covers,
      last_visit_at       = s.last_visit
  from (
    select
      count(*) filter (where status in ('completed', 'seated'))       as visits,
      count(*) filter (where status = 'no_show')                      as no_shows,
      count(*) filter (where status = 'cancelled')                    as cancellations,
      coalesce(sum(party_size) filter
        (where status in ('completed', 'seated')), 0)                 as covers,
      max(starts_at) filter (where status in ('completed', 'seated')) as last_visit
    from reservations
    where guest_id = p_guest_id
  ) s
  where g.id = p_guest_id;
end;
$$;

create or replace function reservations_sync_guest_stats()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform refresh_guest_stats(old.guest_id);
    return old;
  end if;

  perform refresh_guest_stats(new.guest_id);
  if tg_op = 'UPDATE' and old.guest_id is distinct from new.guest_id then
    perform refresh_guest_stats(old.guest_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_guest_stats on reservations;
create trigger reservations_guest_stats
  after insert or update of status, guest_id, party_size or delete on reservations
  for each row execute function reservations_sync_guest_stats();

-- ============================================================
-- D. MESAS JUNTADAS
--
-- Una reserva de grupo grande puede ocupar varias mesas. La exclusión
-- anti-solapamiento de `reservations` solo cubre `table_id`, así que las mesas
-- adicionales se registran aquí con su propia restricción de exclusión: la
-- garantía de "una mesa, una reserva" sigue estando en la base de datos, no
-- en el código de aplicación.
-- ============================================================

create table if not exists reservation_tables (
  reservation_id uuid not null references reservations(id) on delete cascade,
  table_id       uuid not null references restaurant_tables(id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null,
  primary key (reservation_id, table_id),
  constraint reservation_tables_no_overlap
    exclude using gist (
      table_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status not in ('cancelled', 'no_show'))
);

create index if not exists idx_reservation_tables_table on reservation_tables (table_id, starts_at);

alter table reservation_tables enable row level security;

drop policy if exists "reservation_tables_tenant_read" on reservation_tables;
create policy "reservation_tables_tenant_read" on reservation_tables
  for select using (
    reservation_id in (select id from reservations where restaurant_id = auth_restaurant_id())
  );

-- Mantiene horario y estado de las mesas juntadas en sincronía con la reserva.
create or replace function reservation_tables_sync()
returns trigger
language plpgsql
as $$
begin
  update reservation_tables
  set starts_at = new.starts_at,
      ends_at   = new.ends_at,
      status    = new.status
  where reservation_id = new.id;
  return new;
end;
$$;

drop trigger if exists reservations_sync_tables on reservations;
create trigger reservations_sync_tables
  after update of starts_at, ends_at, status on reservations
  for each row execute function reservation_tables_sync();

-- ============================================================
-- E. AUDIT LOG
-- ============================================================

create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  actor_id      uuid references profiles(id) on delete set null,
  actor_name    text,
  action        text not null,
  entity        text not null,
  entity_id     uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_restaurant_date on audit_log (restaurant_id, created_at desc);
create index if not exists idx_audit_entity          on audit_log (entity, entity_id);

alter table audit_log enable row level security;

drop policy if exists "audit_admin_read" on audit_log;
create policy "audit_admin_read" on audit_log
  for select using (
    restaurant_id = auth_restaurant_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- F. BACKFILL — crear fichas de comensal para las reservas existentes
-- ============================================================

-- El teléfono es la clave natural del comensal, así que hay que normalizarlo
-- igual que hace la aplicación (src/lib/phone.ts). Si no, "600 11 22 33" y
-- "+34600112233" crean dos fichas para la misma persona y el historial de
-- visitas y no-shows queda partido.
create or replace function normalize_es_phone(raw text)
returns text
language sql
immutable
as $$
  with digits as (
    select regexp_replace(
      regexp_replace(coalesce(raw, ''), '[^0-9+]', '', 'g'),
      '^(00|\+)34', ''
    ) as d
  )
  select case
    when d ~ '^[6-9][0-9]{8}$' then '+34' || d
    when d ~ '^\+[0-9]{8,15}$' then d
    when d = '' then null
    else d
  end
  from digits;
$$;

-- Normalizar también los teléfonos ya guardados en las reservas, para que
-- coincidan con la ficha del comensal.
update reservations
set guest_phone = normalize_es_phone(guest_phone)
where guest_phone is not null
  and guest_phone <> ''
  and normalize_es_phone(guest_phone) is not null
  and normalize_es_phone(guest_phone) <> guest_phone;

insert into guests (restaurant_id, phone, name, email)
select distinct on (r.restaurant_id, normalize_es_phone(r.guest_phone))
       r.restaurant_id,
       normalize_es_phone(r.guest_phone),
       r.guest_name,
       r.guest_email
from reservations r
where r.guest_phone is not null
  and r.guest_phone <> ''
  and normalize_es_phone(r.guest_phone) is not null
order by r.restaurant_id, normalize_es_phone(r.guest_phone), r.created_at desc
on conflict (restaurant_id, phone) do nothing;

update reservations r
set guest_id = g.id
from guests g
where g.restaurant_id = r.restaurant_id
  and g.phone = normalize_es_phone(r.guest_phone)
  and r.guest_id is null;

-- Las reservas anteriores a esta migración solo tienen `table_id`. Sin volcarlas
-- a `reservation_tables`, la restricción de exclusión de esa tabla no las ve y
-- una reserva nueva con mesas juntadas podría solaparse con ellas.
insert into reservation_tables (reservation_id, table_id, starts_at, ends_at, status)
select id, table_id, starts_at, ends_at, status
from reservations
where table_id is not null
on conflict (reservation_id, table_id) do nothing;

-- Recalcular contadores de todas las fichas creadas.
do $$
declare gid uuid;
begin
  for gid in select id from guests loop
    perform refresh_guest_stats(gid);
  end loop;
end;
$$;
