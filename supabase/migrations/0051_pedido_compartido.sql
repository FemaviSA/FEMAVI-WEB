-- Duplas: el que carga el pedido puede anotar con quién salió ("Comparto
-- con"). Es solo un dato para la liquidación, que Santiago hace aparte: el
-- pedido, la facturación y el cliente quedan enteros de quien lo carga, y la
-- estadística no cambia. Santiago, 01/10/2026.

alter table public.orders add column if not exists compartido_con text;

-- Al guardar: tiene que ser otro vendedor activo del mismo proyecto.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.pedido_insertar(jsonb,text,text)'::regprocedure) into d;

  n := replace(d, $a$  v_cod   text;
begin$a$, $b$  v_cod   text;
  v_comparte text := nullif(btrim(coalesce(p->>'compartido_con', '')), '');
begin
  if v_comparte is not null and (
       v_comparte = p_seller
       or not exists (select 1 from public.sellers
                       where code = v_comparte and active
                         and proyecto = coalesce(p_proyecto, 'femavi'))) then
    raise exception 'compartido_invalido' using errcode = 'P0001';
  end if;$b$);

  n := replace(n, $a$order_number, account, sales_cycle, purchase_order, ship_date,
    seller_code,$a$, $b$order_number, account, sales_cycle, purchase_order, ship_date,
    seller_code, compartido_con,$b$);

  n := replace(n, $a$    p_seller,
    coalesce((p->>'is_new_client')::boolean, false),$a$, $b$    p_seller,
    v_comparte,
    coalesce((p->>'is_new_client')::boolean, false),$b$);

  if position('compartido_invalido' in n) = 0 or position('seller_code, compartido_con' in n) = 0
     or position('v_comparte,' in n) = 0 then
    raise exception 'pedido_insertar: no encontre el texto';
  end if;
  execute n;
end $$;

-- Con quién puede compartir el vendedor: los otros activos de su proyecto.
create or replace function public.seller_companeros(p_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_proy text;
begin
  select proyecto into v_proy from public.sellers where code = v_code;
  return coalesce((
    select jsonb_agg(jsonb_build_object('code', code, 'name', name) order by lpad(code, 6, '0'))
      from public.sellers
     where proyecto = v_proy and active and code <> v_code), '[]'::jsonb);
end;
$fn$;
revoke all on function public.seller_companeros(text) from public, anon, authenticated;
grant execute on function public.seller_companeros(text) to anon, authenticated;
