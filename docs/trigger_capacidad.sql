-- ============================================================
-- Trigger OPCIONAL de capacidad a nivel de base de datos
-- ============================================================
-- La app ya garantiza la capacidad en el server action
-- (src/actions/appointments.ts → checkCapacity). Este trigger añade una
-- segunda barrera a nivel de BD, útil si hay alta concurrencia.
--
-- ⚠️ Aplícalo con psql, NO con el SQL Editor del panel ni con `supabase db
-- push`: ambos parten el cuerpo de la función por los ';' internos.
--   psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f docs/trigger_capacidad.sql
-- La connection string está en: Supabase → Project Settings → Database.
-- ============================================================

create or replace function check_slot_capacity()
returns trigger language plpgsql as $capacity$
declare
  cap      int;
  day_cap  int;
  overlaps int;
  dow      int;
begin
  if new.status <> 'active' then
    return new;
  end if;

  dow := extract(dow from (new.starts_at at time zone 'Europe/Madrid'))::int;

  select bh.slot_capacity into day_cap
    from business_hours bh
   where bh.salon_id = new.salon_id and bh.day_of_week = dow;

  select s.slot_capacity into cap from salons s where s.id = new.salon_id;

  cap := coalesce(day_cap, cap, 1);

  select coalesce(max(concurrent), 0) into overlaps
  from (
    select (
      select count(*)
        from appointments a2
       where a2.salon_id = new.salon_id
         and a2.status = 'active'
         and a2.id <> new.id
         and a2.starts_at <= pts.t
         and a2.ends_at  >  pts.t
    ) as concurrent
    from (
      select new.starts_at as t
      union
      select a.starts_at
        from appointments a
       where a.salon_id = new.salon_id
         and a.status = 'active'
         and a.id <> new.id
         and a.starts_at >= new.starts_at
         and a.starts_at <  new.ends_at
    ) pts
  ) c;

  if overlaps >= cap then
    raise exception 'Tramo completo: capacidad % alcanzada', cap
      using errcode = '23P01';
  end if;

  return new;
end;
$capacity$;

drop trigger if exists appointments_capacity_check on appointments;
create trigger appointments_capacity_check
  before insert or update on appointments
  for each row execute function check_slot_capacity();
