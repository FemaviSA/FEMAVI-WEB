-- El sistema viejo marca los comprobantes anulados y nosotros no lo leíamos:
-- la venta seguía contada en la ficha del cliente y el costo en la factura
-- interna. En el registro de HISTPEDI el estado está en la posición 115
-- ('1' = anulado) y la fecha de anulación en la 116-124.
--
-- Lo encontramos con el remito 138731 (JORGE MARSELL, pedido web 218121,
-- $433.500): Santiago rechazó el pedido el 30/10/2026, el remito salió igual
-- el 02/11 y después se anuló, con fecha de anulación 30/10. Es el único
-- comprobante anulado de 2026; desde 2019 hay 12 y en todo el histórico 3.888.
--
-- Los registros cortos de 152 bytes (factura electrónica) no traen este bloque
-- —son justo los 18 lugares que les faltan—, así que quedan como no anulados,
-- que es lo correcto.

alter table public.hist_comprobantes
  add column if not exists anulado boolean not null default false,
  add column if not exists fecha_anulacion date;

comment on column public.hist_comprobantes.anulado is
  'HISTPEDI pos. 115 = ''1''. Un comprobante anulado no es una venta: no suma en la ficha del cliente ni en la factura interna.';
comment on column public.hist_comprobantes.fecha_anulacion is 'HISTPEDI pos. 116-124.';

create index if not exists hist_comprobantes_anulado_idx
  on public.hist_comprobantes (anulado) where anulado;

-- ── El sincronizador sube las dos columnas nuevas ──
-- Se escriben con coalesce contra lo que ya está: si la PC de la oficina
-- todavía corre el sincronizador viejo (que no manda estos campos), no borra
-- lo que ya cargamos.
create or replace function public.hist_sync_subir(p_key text, p_tabla text, p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id bigint := public.hist_sync_validar(p_key);
  n integer;
begin
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 2000 then
    raise exception 'lote invalido';
  end if;

  if p_tabla = 'articulos' then
    insert into public.hist_articulos
    select * from jsonb_populate_recordset(null::public.hist_articulos, p_filas) where codigo is not null
    on conflict (codigo) do update set familia = excluded.familia, descripcion = excluded.descripcion;
  elsif p_tabla = 'clientes' then
    insert into public.hist_clientes
    select * from jsonb_populate_recordset(null::public.hist_clientes, p_filas) where codigo is not null
    on conflict (codigo) do update set
      razon_social = excluded.razon_social, cuit = excluded.cuit, domicilio = excluded.domicilio,
      localidad = excluded.localidad, provincia = excluded.provincia, iva = excluded.iva,
      zona = excluded.zona, vendedor = excluded.vendedor, expreso = excluded.expreso,
      telefonos = excluded.telefonos, otros = excluded.otros, cuit_formateado = excluded.cuit_formateado,
      fecha_alta = excluded.fecha_alta, entrega_domicilio = excluded.entrega_domicilio,
      entrega_localidad = excluded.entrega_localidad, entrega_provincia = excluded.entrega_provincia,
      entrega_telefono = excluded.entrega_telefono, paga_flete = excluded.paga_flete,
      cod_proveedor = excluded.cod_proveedor, resp_compras = excluded.resp_compras,
      cond_pago = excluded.cond_pago;
  elsif p_tabla = 'expresos' then
    insert into public.hist_expresos
    select * from jsonb_populate_recordset(null::public.hist_expresos, p_filas) where codigo is not null
    on conflict (codigo) do update set
      nombre = excluded.nombre, domicilio = excluded.domicilio, localidad = excluded.localidad,
      telefonos = excluded.telefonos, recorrido = excluded.recorrido, alias = excluded.alias;
  elsif p_tabla = 'comprobantes' then
    insert into public.hist_comprobantes
      (clave, pedido, comprobante, tipo, cliente, fecha, total, fecha_comprobante,
       vendedor, anulado, fecha_anulacion)
    select f.clave, f.pedido, f.comprobante, f.tipo, f.cliente, f.fecha, f.total,
           f.fecha_comprobante, f.vendedor, coalesce(f.anulado, false), f.fecha_anulacion
      from jsonb_populate_recordset(null::public.hist_comprobantes, p_filas) f
     where f.clave is not null
    on conflict (clave) do update set
      pedido = excluded.pedido, comprobante = excluded.comprobante, tipo = excluded.tipo,
      cliente = excluded.cliente, fecha = excluded.fecha, total = excluded.total,
      fecha_comprobante = coalesce(excluded.fecha_comprobante, hist_comprobantes.fecha_comprobante),
      vendedor = coalesce(excluded.vendedor, hist_comprobantes.vendedor),
      anulado = coalesce(excluded.anulado, hist_comprobantes.anulado),
      fecha_anulacion = coalesce(excluded.fecha_anulacion, hist_comprobantes.fecha_anulacion);
  elsif p_tabla = 'remitos_pendientes' then
    delete from public.hist_remitos_pendientes where true;
    insert into public.hist_remitos_pendientes (comprobante, cliente, fecha, pedido, vendedor)
    select comprobante, cliente, fecha, pedido, vendedor
      from jsonb_populate_recordset(null::public.hist_remitos_pendientes, p_filas)
     where comprobante is not null
    on conflict (comprobante) do nothing;
  elsif p_tabla = 'comprobantes_vendedor' then
    update public.hist_comprobantes c
       set vendedor = f.vendedor
      from jsonb_to_recordset(p_filas) as f(clave text, vendedor text)
     where c.clave = f.clave and f.vendedor is not null;
  elsif p_tabla = 'comprobantes_anulados' then
    update public.hist_comprobantes c
       set anulado = f.anulado, fecha_anulacion = f.fecha_anulacion
      from jsonb_to_recordset(p_filas) as f(clave text, anulado boolean, fecha_anulacion date)
     where c.clave = f.clave and f.anulado is not null;
  elsif p_tabla = 'renglones' then
    insert into public.hist_renglones
    select * from jsonb_populate_recordset(null::public.hist_renglones, p_filas) where clave is not null and linea is not null
    on conflict (clave, linea) do update set
      articulo = excluded.articulo, cantidad = excluded.cantidad, envase = excluded.envase,
      kilos = excluded.kilos, precio = excluded.precio, importe = excluded.importe;
  else
    raise exception 'tabla desconocida';
  end if;

  get diagnostics n = row_count;
  update public.hist_sync_claves set ultimo_cambio_at = now(), refresco_pendiente = true where id = v_id;
  return n;
end;
$function$;

-- Los permisos quedan como estaban: el sincronizador la llama con la clave
-- anónima y su propia clave de sincronización (p_key), así que anon la ejecuta.
revoke all on function public.hist_sync_subir(text, text, jsonb) from public, authenticated;
grant execute on function public.hist_sync_subir(text, text, jsonb) to service_role, anon;
