-- El vendedor de FemWay puede dejar notas en la ficha de sus clientes. Solo las
-- notas: el resto de los datos los maneja administración. Y solo en los suyos,
-- que es lo que decide la base con el pase de sesión.
--
-- Es la misma nota que ve y edita el admin: si el vendedor anota algo, del otro
-- lado se lee, que es justamente para lo que sirve.
create or replace function public.seller_femway_guardar_nota(p_token text, p_codigo text, p_notas text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_proy text;
  v_cod  text := lpad(nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), ''), 5, '0');
begin
  select proyecto into v_proy from public.sellers where code = v_code;
  if v_proy <> 'femway' then raise exception 'no autorizado'; end if;
  if v_cod is null then raise exception 'Falta el código del cliente.'; end if;

  update public.femway_clientes
     set notas = nullif(btrim(coalesce(p_notas, '')), ''),
         updated_at = now()
   where codigo = v_cod and vendedor = v_code;

  if not found then
    raise exception 'Ese cliente no es tuyo.';
  end if;
end;
$fn$;
revoke all on function public.seller_femway_guardar_nota(text, text, text) from public, anon, authenticated;
grant execute on function public.seller_femway_guardar_nota(text, text, text) to anon, authenticated;
