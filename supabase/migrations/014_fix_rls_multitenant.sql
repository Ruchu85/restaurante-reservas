-- ============================================================
-- MIGRACIÓN 014: ARREGLAR RLS MULTI-TENANT
-- Las políticas "using (true)" del restaurante permiten que
-- usuarios del salón lean datos del restaurante y viceversa.
-- Las reemplazamos por políticas que filtran por tenant.
-- ============================================================

-- RESTAURANTS: solo visible para usuarios con restaurant_id en perfil
drop policy if exists "staff_read_restaurant" on restaurants;
create policy "restaurants_tenant_read"
  on restaurants for select
  using (
    id = (select restaurant_id from profiles where id = auth.uid())
  );

-- RESTAURANT_TABLES: solo para usuarios del mismo restaurante
drop policy if exists "staff_read_tables" on restaurant_tables;
create policy "restaurant_tables_tenant_read"
  on restaurant_tables for select
  using (
    restaurant_id = (select restaurant_id from profiles where id = auth.uid())
  );

-- RESERVATIONS: solo para usuarios del mismo restaurante
drop policy if exists "staff_read_reservations" on reservations;
create policy "reservations_tenant_read"
  on reservations for select
  using (
    restaurant_id = (select restaurant_id from profiles where id = auth.uid())
  );

-- WAITLIST: solo para usuarios del mismo restaurante
drop policy if exists "staff_read_waitlist" on waitlist;
create policy "waitlist_tenant_read"
  on waitlist for select
  using (
    restaurant_id = (select restaurant_id from profiles where id = auth.uid())
  );

-- BUSINESS_HOURS: política multi-tenant — solo ve las de su tenant
drop policy if exists "staff_read_hours" on business_hours;
create policy "business_hours_tenant_read"
  on business_hours for select
  using (
    (restaurant_id is not null
     and restaurant_id = (select restaurant_id from profiles where id = auth.uid()))
    or
    (salon_id is not null
     and salon_id = auth_salon_id())
  );

-- BLOCKED_DAYS: política multi-tenant
drop policy if exists "staff_read_blocked" on blocked_days;
create policy "blocked_days_tenant_read"
  on blocked_days for select
  using (
    (restaurant_id is not null
     and restaurant_id = (select restaurant_id from profiles where id = auth.uid()))
    or
    (salon_id is not null
     and salon_id = auth_salon_id())
  );

-- PROFILES: evitar que un usuario del salón vea perfil de usuario del restaurante
-- La política existente "staff_read_profile" usa (auth.uid() = id), es correcta.
-- Solo añadir: usuarios del mismo salón pueden ver otros perfiles del mismo salón (admin).
-- (ya cubierto por "profiles_admin_read" en migration 013)
