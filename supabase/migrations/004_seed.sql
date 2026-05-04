-- ============================================================
-- SEED MÍNIMO
-- Crea un salón de demo con horarios y profesionales.
-- El usuario admin debe crearse en Supabase Auth → Dashboard
-- y luego asignarse el role y salon_id en profiles.
-- ============================================================

-- Salón de demo
insert into salons (id, name, slug, address, phone, email, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Salón Demo',
  'salon-demo',
  'Calle Mayor 1, Madrid',
  '+34 600 000 000',
  'hola@salondemo.es',
  'Europe/Madrid'
) on conflict (slug) do nothing;

-- Horarios (Lun-Vie 9:00-20:00, Sáb 9:00-14:00, Dom cerrado)
insert into business_hours (salon_id, day_of_week, opens_at, closes_at, is_open)
values
  ('00000000-0000-0000-0000-000000000001', 0, '09:00', '20:00', false), -- Domingo
  ('00000000-0000-0000-0000-000000000001', 1, '09:00', '20:00', true),  -- Lunes
  ('00000000-0000-0000-0000-000000000001', 2, '09:00', '20:00', true),  -- Martes
  ('00000000-0000-0000-0000-000000000001', 3, '09:00', '20:00', true),  -- Miércoles
  ('00000000-0000-0000-0000-000000000001', 4, '09:00', '20:00', true),  -- Jueves
  ('00000000-0000-0000-0000-000000000001', 5, '09:00', '20:00', true),  -- Viernes
  ('00000000-0000-0000-0000-000000000001', 6, '09:00', '14:00', true)   -- Sábado
on conflict (salon_id, day_of_week) do nothing;

-- Profesionales de ejemplo
insert into staff_members (id, salon_id, name, active)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'María García', true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Carlos López', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Ana Martínez', true)
on conflict (id) do nothing;
