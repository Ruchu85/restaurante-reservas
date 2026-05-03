-- ============================================================
-- SEED MÍNIMO
-- Crea un salón de demo con servicios y horarios por defecto.
-- Los datos de usuario admin deben crearse manualmente en
-- Supabase Dashboard → Auth o via la CLI.
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

-- Horarios (Lun-Sab, 9:00-20:00; Dom cerrado)
insert into business_hours (salon_id, staff_id, day_of_week, open_time, close_time, is_open)
values
  ('00000000-0000-0000-0000-000000000001', null, 0, '09:00', '20:00', false), -- Domingo
  ('00000000-0000-0000-0000-000000000001', null, 1, '09:00', '20:00', true),  -- Lunes
  ('00000000-0000-0000-0000-000000000001', null, 2, '09:00', '20:00', true),  -- Martes
  ('00000000-0000-0000-0000-000000000001', null, 3, '09:00', '20:00', true),  -- Miércoles
  ('00000000-0000-0000-0000-000000000001', null, 4, '09:00', '20:00', true),  -- Jueves
  ('00000000-0000-0000-0000-000000000001', null, 5, '09:00', '20:00', true),  -- Viernes
  ('00000000-0000-0000-0000-000000000001', null, 6, '09:00', '14:00', true)   -- Sábado
on conflict (salon_id, staff_id, day_of_week) do nothing;

-- Profesionales
insert into staff_members (id, salon_id, display_name, bio, active)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'María García', 'Especialista en color y mechas', true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Carlos López', 'Experto en cortes modernos', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Ana Martínez', 'Tratamientos capilares y nutrición', true)
on conflict (id) do nothing;

-- Servicios
insert into services (id, salon_id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, price_cents, active)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Corte de cabello', 'Corte personalizado con lavado y secado', 45, 0, 5, 2500, true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Coloración completa', 'Tinte de raíz a puntas con productos premium', 120, 0, 10, 6000, true),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Mechas', 'Mechas o balayage personalizadas', 150, 0, 15, 8000, true),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Peinado', 'Peinado para eventos especiales', 60, 0, 0, 3500, true),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Tratamiento keratina', 'Alisado y nutrición con keratina profesional', 180, 0, 10, 9500, true)
on conflict (id) do nothing;
