-- El vendedor de FemWay tiene su solapa "Mis clientes", igual que el de FEMAVI:
-- entra a cualquiera y ve su ABM y su historial. Solo los suyos: el código sale
-- del pase de sesión, no de un parámetro.
--
-- La ficha se parte en una base sin permisos y dos puertas, que es el mismo
-- patrón que ya usa la de FEMAVI.

create or replace function public.seller_femway_clientes(p_token text, p_q text default null)
returns table (
  codigo text, razon_social text, cuit text, localidad text, telefonos text,
  pedidos bigint, ultima_compra timestamptz, comprado numeric, volumen numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code    text := public.seller_de_token(p_token);
  q         text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  return query
  with suyos as (
    select c.* from public.femway_clientes c where c.vendedor = v_code
  ),
  pedidos as (
    select regexp_replace(coalesce(o.client_code, ''), '\D', '', 'g') as cod,
           o.id, o.created_at, o.total, o.items
      from public.orders o
     where o.proyecto = 'femway'
       and o.status in ('aprobado', 'ingresado', 'facturado', 'entregado')
  )
  select s.codigo, s.razon_social, s.cuit, s.localidad, s.telefonos,
         count(p.id),
         max(p.created_at),
         coalesce(sum(p.total), 0),
         coalesce((select sum(coalesce((i->>'quantity')::numeric, 0))
                     from pedidos p2, jsonb_array_elements(coalesce(p2.items, '[]'::jsonb)) i
                    where p2.cod = ltrim(s.codigo, '0')), 0)
    from suyos s
    left join pedidos p on p.cod = ltrim(s.codigo, '0')
   where (q is null
          or s.razon_social ilike '%' || q || '%'
          or s.localidad ilike '%' || q || '%'
          or (q_digitos is not null and (s.codigo = lpad(q_digitos, 5, '0') or s.cuit like '%' || q_digitos || '%')))
   group by s.codigo, s.razon_social, s.cuit, s.localidad, s.telefonos
   order by max(p.created_at) desc nulls last, s.razon_social;
end;
$fn$;
revoke all on function public.seller_femway_clientes(text, text) from public, anon, authenticated;
grant execute on function public.seller_femway_clientes(text, text) to anon, authenticated;

-- La ficha, sin control de permisos: no se expone, la usan las dos de abajo.
-- (El cuerpo es el de admin_femway_ficha_cliente en 0037, sin el is_admin.)
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_femway_ficha_cliente';
  d := replace(d, 'FUNCTION public.admin_femway_ficha_cliente(p_codigo text)',
                  'FUNCTION public.femway_ficha_base(p_codigo text)');
  d := replace(d, '  if not public.is_admin() then raise exception ''no autorizado''; end if;' || chr(10), '');
  if position('is_admin' in d) > 0 then
    raise exception 'no pude sacar el control de permisos';
  end if;
  execute d;
end $$;
revoke all on function public.femway_ficha_base(text) from public, anon, authenticated;

create or replace function public.admin_femway_ficha_cliente(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return public.femway_ficha_base(p_codigo);
end;
$fn$;
revoke all on function public.admin_femway_ficha_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_femway_ficha_cliente(text) to authenticated;

create or replace function public.seller_femway_ficha_cliente(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_cod  text := lpad(nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), ''), 5, '0');
begin
  if v_cod is null then return null; end if;
  if not exists (select 1 from public.femway_clientes where codigo = v_cod and vendedor = v_code) then
    return null;
  end if;
  return public.femway_ficha_base(v_cod);
end;
$fn$;
revoke all on function public.seller_femway_ficha_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_femway_ficha_cliente(text, text) to anon, authenticated;
