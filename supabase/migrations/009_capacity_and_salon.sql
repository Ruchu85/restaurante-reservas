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
-- NOTA sobre la garantía de capacidad
-- ============================================================
-- La validación de "no exceder la capacidad del tramo" se realiza en el
-- server action (src/actions/appointments.ts → checkCapacity), no con un
-- trigger de BD. Motivo: el divisor de sentencias del SQL Editor / CLI de
-- Supabase parte el cuerpo de las funciones por los ';' internos y no es
-- fiable para aplicar funciones plpgsql desde estas migraciones.
--
-- Si quieres además la garantía a nivel de base de datos (recomendado en
-- entornos con alta concurrencia), aplica el trigger opcional incluido en
-- docs/trigger_capacidad.sql ejecutándolo con psql (no con el SQL Editor):
--   psql "<connection-string>" -f docs/trigger_capacidad.sql
