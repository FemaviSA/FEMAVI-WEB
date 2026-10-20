-- La ficha del admin avisa si el cliente no coincide con el sistema viejo. Al
-- vendedor no se le muestra: él no ve el sistema viejo y no es su problema.
--
-- (Aplicada en Supabase como 0048_ficha_femway_avisa_las_diferencias.)

create or replace function public.admin_femway_ficha_cliente(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return public.femway_ficha_base(p_codigo)
         || jsonb_build_object('diferencias', public.femway_diferencias_cliente(p_codigo));
end;
$function$;

revoke all on function public.admin_femway_ficha_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_femway_ficha_cliente(text) to authenticated;
