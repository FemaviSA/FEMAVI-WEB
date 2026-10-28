-- Los meses de la factura interna: de octubre 2026 al mes en curso, y más
-- allá si ya hay un comprobante de FemWay con fecha posterior. Un remito con
-- fecha de noviembre hecho en octubre abre noviembre en el momento.

create or replace function public.admin_factura_interna_meses()
returns date[]
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hasta date;
begin
  if not public.is_admin() or public.admin_proyecto() is not null then
    raise exception 'no autorizado';
  end if;

  select greatest(
           date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires'))::date,
           coalesce(date_trunc('month', max(c.fecha))::date, date '2026-10-01'))
    into v_hasta
    from public.hist_comprobantes c
    join public.orders o on o.order_number = c.pedido::text and o.proyecto = 'femway'
   where c.tipo in ('9','7','3');

  return array(select g::date
                 from generate_series(date '2026-10-01', v_hasta, interval '1 month') g
                order by g desc);
end;
$function$;

revoke all on function public.admin_factura_interna_meses() from public, anon, authenticated;
grant execute on function public.admin_factura_interna_meses() to authenticated;
