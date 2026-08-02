-- ============================================================
-- MIGRACIÓN 016: REGLAS DE SERVICIO
--
-- Tres cosas que cualquier restaurante español da por supuestas y que hasta
-- ahora no se podían configurar:
--
--  A) Última sentada. Con comida de 13:30 a 16:00 y 90 min por reserva, el
--     último hueco ofrecido era las 14:30. Ningún restaurante rechaza una mesa
--     a las 15:15: lo que se cierra es la ENTRADA, no la sobremesa.
--  B) Duración por tamaño de grupo. Una pareja no ocupa la mesa lo mismo que
--     un grupo de diez.
--  C) Protección frente a no-shows. Ya se contaban en la ficha del comensal
--     pero no se usaban para nada.
-- ============================================================

-- ── A. Última sentada ────────────────────────────────────────
alter table restaurants
  add column if not exists last_seating_offset_minutes int not null default 0;

comment on column restaurants.last_seating_offset_minutes is
  'Minutos antes del cierre en los que se acepta la última entrada. '
  '0 = la reserva debe caber entera dentro del turno (comportamiento clásico).';

-- ── B. Duración según el tamaño del grupo ────────────────────
alter table restaurants
  add column if not exists large_party_threshold int not null default 6,
  add column if not exists large_party_duration_minutes int;

comment on column restaurants.large_party_threshold is
  'A partir de cuántos comensales se considera grupo grande.';
comment on column restaurants.large_party_duration_minutes is
  'Duración para grupos grandes. NULL = usa reservation_duration_minutes.';

-- `ADD CONSTRAINT` no admite `IF NOT EXISTS`: se ignora si ya existe para que
-- la migración se pueda reejecutar sin abortar.
do $$
begin
  alter table restaurants
    add constraint restaurants_large_party_threshold_check
      check (large_party_threshold >= 1);
exception
  when duplicate_object then null;
end;
$$;

-- ── C. Protección frente a no-shows ──────────────────────────
alter table restaurants
  add column if not exists block_online_after_no_shows int;

comment on column restaurants.block_online_after_no_shows is
  'Nº de no-shows a partir del cual el comensal no puede reservar online y '
  'debe llamar. NULL = sin bloqueo.';

-- ── Índice de apoyo ──────────────────────────────────────────
-- El chequeo de no-shows busca la ficha por (restaurante, teléfono) en cada
-- reserva pública; el índice único de `guests` ya lo cubre, pero este filtro
-- parcial acelera el listado de reincidentes en el panel.
create index if not exists idx_guests_no_shows
  on guests (restaurant_id, no_shows_count)
  where no_shows_count > 0;
