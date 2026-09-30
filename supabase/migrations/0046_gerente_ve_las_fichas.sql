-- El gerente del proyecto abre la ficha de cualquier cliente de su proyecto,
-- no solo de los suyos. Solo la ve: la nota la sigue escribiendo el vendedor
-- dueño del cliente (seller_femway_guardar_nota no cambia).

create or replace function public.seller_femway_ficha_cliente(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_cod  text := lpad(nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), ''), 5, '0');
  v_gerente boolean;
begin
  if v_cod is null then return null; end if;
  select es_gerente and proyecto = 'femway' into v_gerente from public.sellers where code = v_code;
  if not exists (select 1 from public.femway_clientes
                  where codigo = v_cod and (vendedor = v_code or coalesce(v_gerente, false))) then
    return null;
  end if;
  return public.femway_ficha_base(v_cod);
end;
$fn$;
revoke all on function public.seller_femway_ficha_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_femway_ficha_cliente(text, text) to anon, authenticated;

-- En la lista de pedidos del equipo, el que vino sin código de cliente lo toma
-- del registro por CUIT, así también se puede abrir su ficha.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.seller_equipo(text,text)'::regprocedure) into d;
  n := replace(d, $a$'cliente', company, 'codigo', client_code, 'total', total,$a$,
    $b$'cliente', company,
                   'codigo', coalesce(client_code,
                     case when v_seller.proyecto = 'femway' then
                       (select f.codigo from public.femway_clientes f
                         where regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g')
                             = nullif(regexp_replace(coalesce(u_cuit, ''), '\D', '', 'g'), '')
                         limit 1) end),
                   'total', total,$b$);
  n := replace(n, $a$select order_number, created_at, seller_code, company, client_code, total, status from ped$a$,
                  $b$select order_number, created_at, seller_code, company, client_code, cuit as u_cuit, total, status from ped$b$);
  n := replace(n, $a$select order_number, created_at, seller_code, company, client_code, total, status from esperando$a$,
                  $b$select order_number, created_at, seller_code, company, client_code, cuit as u_cuit, total, status from esperando$b$);
  if n = d or position('u_cuit' in n) = 0 then raise exception 'no encontre el texto'; end if;
  execute n;
end $$;
