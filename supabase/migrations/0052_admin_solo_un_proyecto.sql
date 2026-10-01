-- Un admin puede ver un solo proyecto. La secretaria de ventas de FemWay
-- recibe y aprueba los pedidos, y maneja vendedores y clientes, pero solo de
-- FemWay: que no le aparezca nada de FEMAVI para que no se confunda. No es una
-- restricción de seguridad (Santiago, 01/10/2026): el panel se arma según esto.
-- Vacío = ve todo, como Santiago, Ventas y Eneas.

alter table public.admin_emails add column if not exists proyecto text
  check (proyecto in ('femavi', 'femway'));

create or replace function public.admin_proyecto()
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select proyecto from public.admin_emails
   where lower(email) = lower(auth.jwt() ->> 'email');
$fn$;
revoke all on function public.admin_proyecto() from public, anon, authenticated;
grant execute on function public.admin_proyecto() to authenticated;
