-- Sincronización automática del historial del sistema viejo.
-- Una PC de la oficina lee los archivos RM/COBOL cada 15 minutos y sube solo lo
-- que cambió. Se identifica con una clave propia que SOLO sirve para escribir
-- las tablas hist_*: no lee nada, no toca pedidos, vendedores ni usuarios.
-- La clave no se guarda: acá queda su hash sha256.

create table if not exists public.hist_sync_claves (
  id                 bigint generated always as identity primary key,
  descripcion        text not null,
  clave_hash         text not null unique,
  activa             boolean not null default true,
  creada_at          timestamptz not null default now(),
  ultimo_uso_at      timestamptz,
  ultimo_cambio_at   timestamptz,
  refresco_pendiente boolean not null default false
);
alter table public.hist_sync_claves enable row level security;
revoke all on public.hist_sync_claves from public, anon, authenticated;

create or replace function public.hist_sync_validar(p_key text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_id bigint;
begin
  update public.hist_sync_claves set ultimo_uso_at = now()
   where activa and clave_hash = encode(digest(coalesce(p_key, ''), 'sha256'), 'hex')
  returning id into v_id;
  if v_id is null then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  return v_id;
end;
$fn$;
revoke all on function public.hist_sync_validar(text) from public, anon, authenticated;

-- Sube hasta 2000 filas de una tabla. Si la fila ya existe, se actualiza.
-- Solo se aceptan las columnas de cada tabla (jsonb_populate_recordset ignora el resto).
create or replace function public.hist_sync_subir(p_key text, p_tabla text, p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
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
  elsif p_tabla = 'comprobantes' then
    insert into public.hist_comprobantes
    select * from jsonb_populate_recordset(null::public.hist_comprobantes, p_filas) where clave is not null
    on conflict (clave) do update set
      pedido = excluded.pedido, comprobante = excluded.comprobante, tipo = excluded.tipo,
      cliente = excluded.cliente, fecha = excluded.fecha, total = excluded.total;
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
$fn$;
revoke all on function public.hist_sync_subir(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.hist_sync_subir(text, text, jsonb) to anon;

-- La PC avisa que terminó una pasada (haya o no cambios): sirve para saber que sigue viva.
create or replace function public.hist_sync_latido(p_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  perform public.hist_sync_validar(p_key);
end;
$fn$;
revoke all on function public.hist_sync_latido(text) from public, anon, authenticated;
grant execute on function public.hist_sync_latido(text) to anon;

-- Recalcular el resumen tarda ~5 s, más que lo que se le permite a una llamada
-- anónima; lo hace pg_cron cuando hay cambios pendientes, y todas las madrugadas
-- para que las ventanas de "últimos 12 meses" avancen aunque no haya novedades.
create or replace function public.hist_sync_refrescar_pendiente()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if exists (select 1 from public.hist_sync_claves where refresco_pendiente) then
    update public.hist_sync_claves set refresco_pendiente = false where refresco_pendiente;
    refresh materialized view concurrently public.hist_resumen_cliente;
  end if;
end;
$fn$;
revoke all on function public.hist_sync_refrescar_pendiente() from public, anon, authenticated;

select cron.schedule('hist-refrescar-pendiente', '*/5 * * * *', 'select public.hist_sync_refrescar_pendiente()');
select cron.schedule('hist-refrescar-diario', '0 6 * * *', 'refresh materialized view concurrently public.hist_resumen_cliente');  -- 03:00 en Argentina

-- Para el admin: cuándo sincronizó por última vez la PC y cuándo hubo novedades.
create or replace function public.hist_estado_sync()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return (select jsonb_build_object('ultimo_uso_at', max(ultimo_uso_at), 'ultimo_cambio_at', max(ultimo_cambio_at))
            from public.hist_sync_claves where activa);
end;
$fn$;
revoke all on function public.hist_estado_sync() from public, anon, authenticated;
grant execute on function public.hist_estado_sync() to authenticated;
