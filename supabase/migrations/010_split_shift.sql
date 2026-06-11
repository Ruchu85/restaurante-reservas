-- ============================================================
-- 010 · Turno partido (mañana/tarde)
-- Segundo tramo horario opcional por día. Si ambos son NULL,
-- el día tiene un único tramo (comportamiento actual).
-- ============================================================
alter table business_hours add column if not exists opens_at_2  time;
alter table business_hours add column if not exists closes_at_2 time;
