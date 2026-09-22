-- Copia de lectura del sistema viejo de FEMAVI (RM/COBOL): clientes, artículos,
-- comprobantes y renglones desde 1995. Se carga con scripts/legado/cargar.mjs a
-- partir de los archivos del servidor; el sistema viejo sigue siendo el que
-- factura. Solo lo leen los administradores.

create table if not exists public.hist_clientes (
  codigo            text primary key,
  razon_social      text,
  cuit              text,
  domicilio         text,
  localidad         text,
  provincia         text,
  iva               text,
  zona              text,
  vendedor          text,
  expreso           text,
  telefonos         text,
  otros             text,
  cuit_formateado   text,
  fecha_alta        date,
  entrega_domicilio text,
  entrega_localidad text,
  entrega_provincia text,
  entrega_telefono  text,
  paga_flete        text,
  cod_proveedor     text,
  resp_compras      text,
  cond_pago         text
);
create index if not exists hist_clientes_vendedor_idx on public.hist_clientes (vendedor);
create index if not exists hist_clientes_zona_idx     on public.hist_clientes (zona);

create table if not exists public.hist_articulos (
  codigo      text primary key,
  familia     text,
  descripcion text
);

-- tipo = último dígito del comprobante: 9 factura, 3 nota de crédito;
-- 4, 6 y 7 todavía sin identificar.
create table if not exists public.hist_comprobantes (
  clave       text primary key,        -- pedido(6) + comprobante(6) + tipo(1), como en el sistema viejo
  pedido      integer,
  comprobante integer,
  tipo        text,
  cliente     text,
  fecha       date,
  total       numeric(16,2)
);
create index if not exists hist_comprobantes_cliente_idx on public.hist_comprobantes (cliente, fecha);
create index if not exists hist_comprobantes_fecha_idx   on public.hist_comprobantes (fecha);
create index if not exists hist_comprobantes_pedido_idx  on public.hist_comprobantes (pedido);

-- Las cantidades se guardan tal cual las tiene el sistema (siempre positivas);
-- el signo lo da el tipo del comprobante.
create table if not exists public.hist_renglones (
  clave    text not null,
  linea    integer not null,
  articulo text,
  cantidad numeric(14,1),
  envase   numeric(10,0),
  kilos    numeric(16,2),
  precio   numeric(16,2),
  importe  numeric(18,2),
  primary key (clave, linea)
);
create index if not exists hist_renglones_articulo_idx on public.hist_renglones (articulo);

-- Solo administradores, y solo lectura desde la web.
do $$
declare t text;
begin
  foreach t in array array['hist_clientes','hist_articulos','hist_comprobantes','hist_renglones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_lee', t);
    execute format('create policy %I on public.%I for select using (public.is_admin())', t || '_admin_lee', t);
  end loop;
end $$;

-- La carga usó una función temporal public.hist_importar protegida con una clave
-- de un solo uso; se borró al terminar (ver scripts/legado/cargar.mjs).
