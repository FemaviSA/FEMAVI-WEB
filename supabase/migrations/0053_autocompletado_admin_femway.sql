-- Al cargar un pedido de FemWay desde el admin, el autocompletado busca en los
-- clientes de FemWay, no en el sistema viejo de FEMAVI. Lo usa la secretaria
-- de FemWay siempre, y cualquier admin cuando elige un vendedor de FemWay.
-- Devuelven lo mismo que admin_datos_cliente / admin_buscar_cliente.

create or replace function public.admin_femway_datos_cliente(p_codigo text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_digitos text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_fw      public.femway_clientes%rowtype;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_digitos = '' then return null; end if;

  select * into v_fw from public.femway_clientes where codigo = lpad(v_digitos, 5, '0');
  if not found then return null; end if;

  return jsonb_build_object(
    'codigo',            v_fw.codigo,
    'company',           v_fw.razon_social,
    'cuit',              v_fw.cuit,
    'bill_address',      v_fw.domicilio,
    'bill_city',         v_fw.localidad,
    'phone',             v_fw.telefonos,
    'client_name',       v_fw.resp_compras,
    'delivery_address',  coalesce(v_fw.entrega_domicilio, v_fw.domicilio),
    'ship_city',         coalesce(v_fw.entrega_localidad, v_fw.localidad),
    'ship_phone',        v_fw.entrega_telefono,
    'zone',              v_fw.zona,
    'nota',              v_fw.notas,
    'vendedor',          v_fw.vendedor
  );
end;
$fn$;
revoke all on function public.admin_femway_datos_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_femway_datos_cliente(text) to authenticated;

create or replace function public.admin_femway_buscar_cliente(p_q text)
returns table(codigo text, razon_social text, localidad text, cuit text, vendedor text)
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  q         text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if q is null or length(q) < 3 then return; end if;

  return query
  select c.codigo, c.razon_social, c.localidad, c.cuit, c.vendedor
    from public.femway_clientes c
   where c.razon_social ilike '%' || q || '%'
      or (q_digitos is not null and regexp_replace(coalesce(c.cuit, ''), '\D', '', 'g') like '%' || q_digitos || '%')
   order by c.razon_social
   limit 8;
end;
$fn$;
revoke all on function public.admin_femway_buscar_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_femway_buscar_cliente(text) to authenticated;
