-- El transporte del cliente vive en el sistema viejo: cada cliente tiene un
-- código de expreso (hist_clientes.expreso, '000' = sin transporte asignado) y
-- los nombres están en MAEEXPRE, que hasta ahora no se sincronizaba. Sin los
-- nombres el código solo no le sirve a nadie: el que lee el Excel necesita
-- "CRUZ DEL SUR", no "043".

create table if not exists public.hist_expresos (
  codigo    text primary key,
  nombre    text,
  domicilio text,
  localidad text,
  telefonos text,
  -- Notas que el sistema viejo guarda al lado del teléfono: recorridos,
  -- asesores, condiciones. Se trae tal cual.
  recorrido text,
  alias     text
);

alter table public.hist_expresos enable row level security;
drop policy if exists hist_expresos_admin_lee on public.hist_expresos;
create policy hist_expresos_admin_lee on public.hist_expresos for select using (public.is_admin());
grant select on public.hist_expresos to authenticated;

create index if not exists hist_clientes_expreso_idx on public.hist_clientes (expreso);

-- El sincronizador de la oficina ahora también sube MAEEXPRE.
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
$function$;

-- El transporte que tiene asignado un cliente del sistema viejo, por nombre.
-- '000' es "sin transporte": no se devuelve nada y la casilla queda libre.
create or replace function public.hist_expreso_de(p_codigo text)
returns text
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select e.nombre
    from public.hist_expresos e
   where e.codigo = lpad(nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), ''), 3, '0')
     and lpad(coalesce(p_codigo, ''), 3, '0') <> '000'
     and nullif(btrim(coalesce(e.nombre, '')), '') is not null;
$$;

revoke all on function public.hist_expreso_de(text) from public, anon, authenticated;
