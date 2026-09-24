-- Autocompletar la planilla con los datos del cliente.
--
-- El vendedor escribe el código y la planilla se llena sola con lo que ya está
-- en el sistema viejo: razón social, CUIT, domicilios, teléfonos. Los productos
-- y los precios no: eso lo carga él.
--
-- Por ahora solo para el código 10 (Gerencia). Para sumar a otro, agregarlo a
-- la lista de CODIGOS_HABILITADOS de abajo.
--
-- No se completan dos campos a propósito:
--   · Condición de IVA: en el sistema viejo es un número del 0 al 9 y no
--     tenemos la tabla que dice qué significa cada uno.
--   · Condición de pago: lo mismo (02, 11, 12, 22…).
-- Poner ahí un valor adivinado sería peor que dejarlo vacío.

create or replace function public.seller_datos_cliente(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  CODIGOS_HABILITADOS constant text[] := array['10'];
  v_code    text := public.seller_de_token(p_token);
  v_digitos text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_fila    public.hist_clientes%rowtype;
begin
  if not (v_code = any (CODIGOS_HABILITADOS)) then return null; end if;
  if v_digitos = '' then return null; end if;

  -- En el sistema viejo el código va con ceros adelante: 119 es "00119".
  select * into v_fila
    from public.hist_clientes
   where codigo = lpad(v_digitos, 5, '0')
     and vendedor = lpad(v_code, 3, '0');
  if not found then return null; end if;

  return jsonb_build_object(
    'codigo',            v_fila.codigo,
    'company',           v_fila.razon_social,
    -- El CUIT a veces viene con un asterisco al final; es una marca interna.
    'cuit',              nullif(btrim(replace(coalesce(v_fila.cuit_formateado, v_fila.cuit, ''), '*', '')), ''),
    'bill_address',      v_fila.domicilio,
    -- La provincia es un código numérico, así que va solo la localidad.
    'bill_city',         v_fila.localidad,
    'phone',             v_fila.telefonos,
    'client_name',       v_fila.resp_compras,
    'delivery_address',  coalesce(v_fila.entrega_domicilio, v_fila.domicilio),
    'ship_city',         coalesce(v_fila.entrega_localidad, v_fila.localidad),
    'ship_phone',        v_fila.entrega_telefono,
    'zone',              v_fila.zona,
    -- La nota del sistema viejo ("BAJA 9/2011", "NO VENDER"): se muestra, no se carga.
    'nota',              nullif(btrim(coalesce(v_fila.otros, '')), '')
  );
end;
$fn$;

revoke all on function public.seller_datos_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_datos_cliente(text, text) to anon, authenticated;
