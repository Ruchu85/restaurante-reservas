-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table salons             enable row level security;
alter table profiles           enable row level security;
alter table staff_members      enable row level security;
alter table services           enable row level security;
alter table business_hours     enable row level security;
alter table staff_availability enable row level security;
alter table staff_time_off     enable row level security;
alter table appointments       enable row level security;
alter table appointment_events enable row level security;

-- ============================================================
-- FUNCIÓN HELPER: obtener salon_id del usuario autenticado
-- ============================================================
create or replace function auth_salon_id()
returns uuid language sql stable security definer as $$
  select salon_id from profiles where id = auth.uid()
$$;

-- ============================================================
-- FUNCIÓN HELPER: obtener rol del usuario autenticado
-- ============================================================
create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- ============================================================
-- SALONS
-- ============================================================
-- Lectura pública del salón (para la landing y reserva)
create policy "salons_public_read"
  on salons for select
  using (true);

-- Solo admin puede modificar su propio salón
create policy "salons_admin_update"
  on salons for update
  using (id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- PROFILES
-- ============================================================
-- El propio usuario puede ver y editar su perfil
create policy "profiles_own_read"
  on profiles for select
  using (id = auth.uid());

create policy "profiles_own_update"
  on profiles for update
  using (id = auth.uid());

-- Admin puede ver perfiles de su salón
create policy "profiles_admin_read"
  on profiles for select
  using (salon_id = auth_salon_id() and auth_role() = 'admin');

-- Se puede insertar al registrarse
create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

-- ============================================================
-- STAFF MEMBERS
-- ============================================================
-- Lectura pública (para elegir profesional en reserva)
create policy "staff_public_read"
  on staff_members for select
  using (active = true);

-- Admin puede gestionar profesionales de su salón
create policy "staff_admin_all"
  on staff_members for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- Staff puede ver a sus compañeros
create policy "staff_staff_read"
  on staff_members for select
  using (salon_id = auth_salon_id() and auth_role() in ('staff', 'admin'));

-- ============================================================
-- SERVICES
-- ============================================================
create policy "services_public_read"
  on services for select
  using (active = true);

create policy "services_admin_all"
  on services for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- BUSINESS HOURS
-- ============================================================
create policy "business_hours_public_read"
  on business_hours for select
  using (true);

create policy "business_hours_admin_all"
  on business_hours for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- STAFF AVAILABILITY
-- ============================================================
create policy "staff_availability_public_read"
  on staff_availability for select
  using (true);

create policy "staff_availability_admin_all"
  on staff_availability for all
  using (
    exists (
      select 1 from staff_members sm
      where sm.id = staff_availability.staff_id
        and sm.salon_id = auth_salon_id()
        and auth_role() = 'admin'
    )
  );

-- ============================================================
-- STAFF TIME OFF
-- ============================================================
create policy "staff_time_off_read"
  on staff_time_off for select
  using (salon_id = auth_salon_id() and auth_role() in ('admin', 'staff'));

create policy "staff_time_off_admin_all"
  on staff_time_off for all
  using (salon_id = auth_salon_id() and auth_role() = 'admin')
  with check (salon_id = auth_salon_id() and auth_role() = 'admin');

-- ============================================================
-- APPOINTMENTS
-- ============================================================
-- Inserción pública (cliente no autenticado puede reservar)
create policy "appointments_public_insert"
  on appointments for insert
  with check (true);

-- Admin y staff ven todas las citas de su salón
create policy "appointments_staff_read"
  on appointments for select
  using (salon_id = auth_salon_id() and auth_role() in ('admin', 'staff'));

-- Admin puede actualizar/cancelar citas de su salón
create policy "appointments_admin_update"
  on appointments for update
  using (salon_id = auth_salon_id() and auth_role() = 'admin');

create policy "appointments_admin_delete"
  on appointments for delete
  using (salon_id = auth_salon_id() and auth_role() = 'admin');

-- Customer autenticado puede ver sus propias citas
create policy "appointments_customer_read"
  on appointments for select
  using (customer_email = (select email from auth.users where id = auth.uid()));

-- ============================================================
-- APPOINTMENT EVENTS
-- ============================================================
create policy "appointment_events_staff_read"
  on appointment_events for select
  using (
    exists (
      select 1 from appointments a
      where a.id = appointment_events.appointment_id
        and a.salon_id = auth_salon_id()
        and auth_role() in ('admin', 'staff')
    )
  );

create policy "appointment_events_insert"
  on appointment_events for insert
  with check (true);
