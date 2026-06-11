-- ============================================================
-- 009 · Capacidad multi-cliente por tramo + datos del salón
-- ============================================================
-- Objetivo:
--   * Permitir atender N clientes simultáneos por franja horaria.
--   * Guardar los datos fiscales/identidad del salón en BD (antes
--     estaban hardcodeados en src/lib/salonConfig.ts), imprescindible
--     para vender la app a varios salones.
--   * Añadir teléfono y notas al cliente (ficha de cliente + WhatsApp).
-- Todo es retrocompatible: capacidad por defecto = 1 (comportamiento actual).
-- ============================================================

-- ---- Capacidad del salón ----------------------------------
alter table salons
  add column if not exists slot_capacity int not null default 1;

-- ---- Datos fiscales / identidad del salón ------------------
alter table salons add column if not exists owner       text;
alter table salons add column if not exists nif         text;
alter table salons add column if not exists city        text;
alter table salons add column if not exists ticket_footer text;

-- ---- Capacidad opcional por día de la semana ---------------
-- null  → hereda la capacidad del salón
alter table business_hours
  add column if not exists slot_capacity int;

-- ---- Cliente: teléfono y notas -----------------------------
alter table customers add column if not exists phone text;
alter table customers add column if not exists notes text;

-- ============================================================
-- TRIGGER: control de capacidad por tramo
-- Cuenta las citas activas del salón que solapan con la nueva
-- y rechaza la inserción/actualización si se alcanza la capacidad.
-- Lanza SQLSTATE 23P01 (exclusion_violation) para que el server
-- action lo traduzca a un mensaje claro, reutilizando el manejo
-- existente del constraint de no-solapamiento.
-- ============================================================
create or replace function check_slot_capacity()
returns trigger language plpgsql as $$
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

  -- Capacidad del día (si está definida) o del salón (o 1 por defecto)
  select bh.slot_capacity into day_cap
    from business_hours bh
   where bh.salon_id = new.salon_id and bh.day_of_week = dow;

  select s.slot_capacity into cap from salons s where s.id = new.salon_id;

  cap := coalesce(day_cap, cap, 1);

  -- Concurrencia máxima de citas EXISTENTES en cualquier instante dentro
  -- del rango de la nueva cita. Se evalúa en los puntos de inicio de las
  -- citas solapadas y en el inicio de la nueva (puntos donde la concurrencia
  -- puede aumentar). Si ese máximo ya alcanza la capacidad, no cabe una más.
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
$$;

drop trigger if exists appointments_capacity_check on appointments;
create trigger appointments_capacity_check
  before insert or update on appointments
  for each row execute function check_slot_capacity();
