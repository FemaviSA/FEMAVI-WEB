-- El cliente que ya tiene transporte asignado en el sistema viejo llega con él
-- puesto en la planilla, y de ahí al Excel que recibe administración. Antes
-- había que acordarse y escribirlo a mano.
--
-- Va el nombre del expreso ("CRUZ DEL SUR"), no el código: el que imprime el
-- pedido no tiene por qué saberse los números.

create or replace function public.seller_datos_cliente(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
    'carrier',           public.hist_expreso_de(v_fila.expreso),
    'nota',              nullif(btrim(coalesce(v_fila.otros, '')), '')
  );
end;
$function$;

create or replace function public.admin_datos_cliente(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_digitos text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_fila    public.hist_clientes%rowtype;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_digitos = '' then return null; end if;

  select * into v_fila from public.hist_clientes where codigo = lpad(v_digitos, 5, '0');
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
    'carrier',           public.hist_expreso_de(v_fila.expreso),
    'nota',              nullif(btrim(coalesce(v_fila.otros, '')), ''),
    'vendedor',          nullif(ltrim(coalesce(v_fila.vendedor, ''), '0'), '')
  );
end;
$function$;

revoke all on function public.seller_datos_cliente(text,text) from public, anon, authenticated;
revoke all on function public.admin_datos_cliente(text) from public, anon, authenticated;
-- El vendedor entra sin cuenta de Supabase: su pase es el token, así que la
-- función tiene que ser llamable por anon (la sesión la valida adentro).
grant execute on function public.seller_datos_cliente(text,text) to anon, authenticated;
grant execute on function public.admin_datos_cliente(text) to authenticated;
