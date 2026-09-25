-- El autocompletado deja de estar limitado al código 10: lo tienen todos los
-- vendedores. Escriben el número de cliente o la razón social y la planilla se
-- llena sola.
--
-- Lo que no cambia, y es lo que importa, es el límite: cada vendedor solo ve SU
-- cartera. El de FEMAVI, los clientes que tiene asignados en el sistema viejo;
-- el de FemWay, los suyos de FemWay. El código sale del pase de sesión y no del
-- formulario, así que nadie puede pedir los de otro.

create or replace function public.seller_datos_cliente(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code    text := public.seller_de_token(p_token);
  v_proy    text;
  v_digitos text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_fila    public.hist_clientes%rowtype;
  v_fw      public.femway_clientes%rowtype;
begin
  if v_digitos = '' then return null; end if;
  select proyecto into v_proy from public.sellers where code = v_code;

  if v_proy = 'femway' then
    select * into v_fw from public.femway_clientes
     where codigo = lpad(v_digitos, 5, '0') and vendedor = v_code;
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
      'nota',              v_fw.notas
    );
  end if;

  select * into v_fila
    from public.hist_clientes
   where codigo = lpad(v_digitos, 5, '0')
     and vendedor = lpad(v_code, 3, '0');
  if not found then return null; end if;

  return jsonb_build_object(
    'codigo',            v_fila.codigo,
    'company',           v_fila.razon_social,
    'cuit',              nullif(btrim(replace(coalesce(v_fila.cuit_formateado, v_fila.cuit, ''), '*', '')), ''),
    'bill_address',      v_fila.domicilio,
    'bill_city',         v_fila.localidad,
    'phone',             v_fila.telefonos,
    'client_name',       v_fila.resp_compras,
    'delivery_address',  coalesce(v_fila.entrega_domicilio, v_fila.domicilio),
    'ship_city',         coalesce(v_fila.entrega_localidad, v_fila.localidad),
    'ship_phone',        v_fila.entrega_telefono,
    'zone',              v_fila.zona,
    'nota',              nullif(btrim(coalesce(v_fila.otros, '')), '')
  );
end;
$fn$;
revoke all on function public.seller_datos_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_datos_cliente(text, text) to anon, authenticated;

create or replace function public.seller_buscar_cliente(p_token text, p_q text)
returns table (codigo text, razon_social text, localidad text, cuit text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code    text := public.seller_de_token(p_token);
  v_proy    text;
  q         text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if q is null or length(q) < 3 then return; end if;
  select proyecto into v_proy from public.sellers where code = v_code;

  if v_proy = 'femway' then
    return query
    select c.codigo, c.razon_social, c.localidad, c.cuit
      from public.femway_clientes c
     where c.vendedor = v_code
       and (c.razon_social ilike '%' || q || '%'
            or (q_digitos is not null and c.cuit like '%' || q_digitos || '%'))
     order by c.razon_social
     limit 8;
    return;
  end if;

  return query
  select c.codigo, c.razon_social, c.localidad, c.cuit
    from public.hist_clientes c
    left join public.hist_resumen_cliente r on r.codigo = c.codigo
   where c.vendedor = lpad(v_code, 3, '0')
     and (c.razon_social ilike '%' || q || '%'
          or (q_digitos is not null and c.cuit like '%' || q_digitos || '%'))
   order by r.ultima_compra desc nulls last, c.razon_social
   limit 8;
end;
$fn$;
revoke all on function public.seller_buscar_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_buscar_cliente(text, text) to anon, authenticated;

