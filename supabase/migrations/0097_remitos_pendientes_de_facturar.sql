-- El sistema viejo guarda en un archivo aparte (REMITOS) los remitos emitidos
-- que todavía no se facturaron. Recién cuando se facturan pasan al histórico.
-- Para la factura interna eso importa por dos cosas:
--
--  1. La mercadería ya salió, así que el mes al que pertenece es el del remito,
--     no el de la factura. El pedido 218127 (INAER) se facturó el 28/10 pero
--     sale con el remito 138742 del 04/11: es de noviembre.
--  2. Cerrar un mes con remitos de ese mes sin facturar deja plata afuera.
--
-- Se guarda solo lo reciente: un remito viejo sin facturar no dice nada y el
-- archivo arrastra basura de los 90.

create table if not exists public.hist_remitos_pendientes (
  comprobante integer primary key,
  cliente     text,
  fecha       date,
  pedido      integer,
  vendedor    text,
  visto_at    timestamptz not null default now()
);

alter table public.hist_remitos_pendientes enable row level security;
drop policy if exists hist_remitos_pendientes_admin_lee on public.hist_remitos_pendientes;
create policy hist_remitos_pendientes_admin_lee on public.hist_remitos_pendientes
  for select using (public.is_admin());
grant select on public.hist_remitos_pendientes to authenticated;

create index if not exists hist_remitos_pendientes_pedido_idx on public.hist_remitos_pendientes (pedido);

-- El sincronizador reemplaza la lista entera en cada pasada: un remito que ya
-- se facturó tiene que desaparecer de acá, y con un upsert nunca se iría.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.hist_sync_subir(text,text,jsonb)'::regprocedure);
  if position($x$  elsif p_tabla = 'comprobantes_vendedor' then$x$ in d) = 0 then
    raise exception 'hist_sync_subir: no encontré dónde agregar los remitos pendientes';
  end if;
  d := replace(d,
    $x$  elsif p_tabla = 'comprobantes_vendedor' then$x$,
    $x$  elsif p_tabla = 'remitos_pendientes' then
    delete from public.hist_remitos_pendientes where true;
    insert into public.hist_remitos_pendientes (comprobante, cliente, fecha, pedido, vendedor)
    select comprobante, cliente, fecha, pedido, vendedor
      from jsonb_populate_recordset(null::public.hist_remitos_pendientes, p_filas)
     where comprobante is not null
    on conflict (comprobante) do nothing;
  elsif p_tabla = 'comprobantes_vendedor' then$x$);
  execute d;
end $$;
