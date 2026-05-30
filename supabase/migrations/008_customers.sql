-- ============================================================
-- CLIENTES
-- Tabla para almacenar clientes del salón con servicio preferido
-- ============================================================
create table if not exists customers (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references salons(id) on delete cascade,
  name              text not null,
  preferred_service text,
  created_at        timestamptz not null default now(),
  unique (salon_id, name)
);

create index if not exists idx_customers_salon
  on customers (salon_id, name);

-- ============================================================
-- RLS
-- ============================================================
alter table customers enable row level security;

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
