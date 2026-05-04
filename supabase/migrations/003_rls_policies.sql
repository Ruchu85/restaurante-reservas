-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table salons        enable row level security;
alter table profiles      enable row level security;
alter table staff_members enable row level security;
alter table business_hours enable row level security;
alter table blocked_days  enable row level security;
alter table appointments  enable row level security;

-- ============================================================
-- FUNCIONES HELPER
-- ============================================================
create or replace function auth_salon_id()
returns uuid language sql stable security definer as $$
  select salon_id from profiles where id = auth.uid()
$$;

create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- ============================================================
-- SALONS — solo admin del salón puede leer y modificar
-- ============================================================
create policy "salons_member_read"
  on salons for select
  using (id = auth_salon_id());

create policy "salons_admin_update"
  on salons for update
  using (id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- PROFILES
-- ============================================================
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

-- ============================================================
-- STAFF MEMBERS — todos los miembros del salón pueden leer
-- ============================================================
create policy "staff_salon_read"
  on staff_members for select
  using (salon_id = auth_salon_id());

create policy "staff_admin_all"
  on staff_members for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- BUSINESS HOURS — lectura para miembros, escritura admin
-- ============================================================
create policy "business_hours_salon_read"
  on business_hours for select
  using (salon_id = auth_salon_id());

create policy "business_hours_admin_all"
  on business_hours for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- BLOCKED DAYS — lectura para miembros, escritura admin
-- ============================================================
create policy "blocked_days_salon_read"
  on blocked_days for select
  using (salon_id = auth_salon_id());

create policy "blocked_days_admin_all"
  on blocked_days for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- APPOINTMENTS — staff ve sus citas, admin ve todas
-- ============================================================
create policy "appointments_staff_own_read"
  on appointments for select
  using (
    salon_id = auth_salon_id()
    and (
      auth_role() = 'admin'
      or staff_id = (select sm.id from staff_members sm where sm.profile_id = auth.uid() limit 1)
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
      or staff_id = (select sm.id from staff_members sm where sm.profile_id = auth.uid() limit 1)
    )
  );

create policy "appointments_admin_delete"
  on appointments for delete
  using (salon_id = auth_salon_id() and auth_role() = 'admin');
