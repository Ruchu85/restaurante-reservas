-- Fix handle_new_user trigger: was referencing old salon_id column after restaurant schema migration
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, restaurant_id, role)
  values (new.id, '00000000-0000-0000-0000-000000000001', 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;
