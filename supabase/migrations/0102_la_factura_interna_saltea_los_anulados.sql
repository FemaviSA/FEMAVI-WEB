-- La factura interna separa los comprobantes anulados: no suman en ningún
-- total y se listan aparte ('anulados'), igual que los remitos sin facturar,
-- para que no desaparezcan en silencio. El mes tampoco se abre por un anulado.
--
-- Noviembre 2026: el remito 138731 (JORGE MARSELL, $433.500, $99.840 de costo)
-- queda afuera del costo y aparece en el aviso.

create or replace function public.admin_factura_interna(p_mes date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_mes   date := date_trunc('month', coalesce(p_mes, current_date))::date;
  v_desde date;
  v_hasta date;
  v_res   jsonb;
begin
  if not public.is_admin() or coalesce(public.admin_proyecto(), 'femway') <> 'femway' then
    raise exception 'no autorizado';
  end if;

  v_desde := case when v_mes <= date '2026-10-01' then date '2000-01-01' else v_mes end;
  v_hasta := (v_mes + interval '1 month - 1 day')::date;

  with todo as (
    select c.clave, c.comprobante, c.pedido, c.total, c.anulado, c.fecha_anulacion,
           coalesce(rp.fecha, c.fecha_comprobante, c.fecha) as fecha,
           case when c.tipo = '9' and c.comprobante >= 100000 then 'remito'
                when c.tipo = '9' then 'papelito'
                else 'nota_credito' end as clase,
           case when c.tipo = '9' then 1 else -1 end as signo,
           coalesce(h.razon_social, o.company) as cliente,
           coalesce(o.seller_code, ltrim(c.vendedor, '0')) as seller_code
      from public.hist_comprobantes c
      left join public.orders o on o.order_number = c.pedido::text and o.proyecto = 'femway'
      left join public.hist_clientes h on h.codigo = c.cliente
      -- El remito de ese pedido, si todavía no se facturó: su fecha manda.
      left join public.hist_remitos_pendientes rp on rp.pedido = c.pedido
     where c.tipo in ('9','7','3')
       -- De FemWay por el pedido de la web, o por el código de vendedor.
       and (o.id is not null
            or (coalesce(rp.fecha, c.fecha_comprobante, c.fecha) >= date '2026-09-01'
                and exists (select 1 from public.sellers s
                             where s.proyecto = 'femway'
                               and lpad(s.code, 3, '0') = lpad(coalesce(c.vendedor, ''), 3, '0'))))
       and coalesce(rp.fecha, c.fecha_comprobante, c.fecha) between v_desde and v_hasta
  ),
  -- Un comprobante anulado en el sistema viejo no es una venta: no entra en
  -- ningún total. Se muestra aparte para que no desaparezca en silencio.
  comp as (select * from todo where not anulado),
  ren as (
    select comp.*, r.linea, r.articulo,
           coalesce(k.producto, a.descripcion, r.articulo) as producto,
           r.kilos, r.precio = 0 as sin_cargo,
           k.costo,
           comp.signo * r.kilos as kg,
           comp.signo * r.kilos * k.costo as importe
      from comp
      join public.hist_renglones r on r.clave = comp.clave
      left join public.costos_quimwey k on k.articulo = r.articulo
      left join public.hist_articulos a on a.codigo = r.articulo
     where r.kilos > 0
  )
  select jsonb_build_object(
    'mes', v_mes,
    'nombre', public.nombre_de_mes(v_mes),
    'desde', v_desde,
    'hasta', v_hasta,
    'ultimo_comprobante', (select max(fecha) from comp),
    'anulados', (select coalesce(jsonb_agg(jsonb_build_object(
                    'comprobante', comprobante, 'fecha', fecha, 'pedido', pedido,
                    'vendedor', seller_code, 'cliente', cliente, 'total', total,
                    'fecha_anulacion', fecha_anulacion) order by fecha), '[]'::jsonb)
                   from todo where anulado),
    'sin_facturar', (select coalesce(jsonb_agg(jsonb_build_object(
                        'comprobante', rp.comprobante, 'fecha', rp.fecha, 'pedido', rp.pedido,
                        'vendedor', ltrim(rp.vendedor, '0'),
                        'cliente', coalesce(h2.razon_social, o2.company))
                        order by rp.fecha), '[]'::jsonb)
                       from public.hist_remitos_pendientes rp
                       left join public.hist_clientes h2 on h2.codigo = rp.cliente
                       left join public.orders o2 on o2.order_number = rp.pedido::text and o2.proyecto = 'femway'
                      where rp.fecha between v_desde and v_hasta
                        and (o2.id is not null
                             or exists (select 1 from public.sellers s2
                                         where s2.proyecto = 'femway'
                                           and lpad(s2.code, 3, '0') = lpad(coalesce(rp.vendedor, ''), 3, '0')))),
    'totales', jsonb_build_object(
      'facturado',    coalesce((select sum(signo * total) from comp), 0),
      'facturado_notas_credito', coalesce((select sum(signo * total) from comp where clase = 'nota_credito'), 0),
      'costo',        coalesce((select sum(importe) from ren), 0),
      'remitos',      coalesce((select sum(importe) from ren where clase = 'remito'), 0),
      'papelitos',    coalesce((select sum(importe) from ren where clase = 'papelito'), 0),
      'notas_credito',coalesce((select sum(importe) from ren where clase = 'nota_credito'), 0),
      'sin_cargo',    coalesce((select sum(importe) from ren where sin_cargo), 0),
      'kg',           coalesce((select sum(kg) from ren), 0),
      'comprobantes', (select count(distinct clave) from ren)
    ),
    'sin_costo', (select coalesce(jsonb_agg(jsonb_build_object(
                     'articulo', articulo, 'producto', producto, 'kg', kg) order by kg desc), '[]'::jsonb)
                    from (select articulo, max(producto) as producto, sum(kg) as kg
                            from ren where costo is null group by articulo) s),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
                     'articulo', articulo, 'producto', producto, 'costo', costo,
                     'salio', salio, 'volvio', volvio, 'sin_cargo', sin_cargo, 'importe', importe)
                     order by importe desc nulls first), '[]'::jsonb)
                    from (select articulo, max(producto) as producto, max(costo) as costo,
                                 coalesce(sum(kilos) filter (where signo > 0), 0) as salio,
                                 coalesce(sum(kilos) filter (where signo < 0), 0) as volvio,
                                 coalesce(sum(kilos) filter (where signo > 0 and sin_cargo), 0) as sin_cargo,
                                 sum(importe) as importe
                            from ren group by articulo) p),
    'comprobantes', (select coalesce(jsonb_agg(jsonb_build_object(
                        'clase', clase, 'comprobante', comprobante, 'pedido', pedido, 'fecha', fecha,
                        'cliente', cliente, 'vendedor', seller_code, 'importe', importe,
                        'renglones', renglones) order by fecha, comprobante), '[]'::jsonb)
                       from (select clase, comprobante, pedido, fecha, cliente, seller_code,
                                    sum(importe) as importe,
                                    jsonb_agg(jsonb_build_object(
                                      'articulo', articulo, 'producto', producto, 'kg', kg,
                                      'costo', costo, 'importe', importe, 'sin_cargo', sin_cargo)
                                      order by linea) as renglones
                               from ren group by clave, clase, comprobante, pedido, fecha, cliente, seller_code) c)
  ) into v_res;

  return v_res;
end;
$function$;

create or replace function public.admin_factura_interna_meses()
returns date[]
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_hasta date;
begin
  if not public.is_admin() or coalesce(public.admin_proyecto(), 'femway') <> 'femway' then
    raise exception 'no autorizado';
  end if;

  select greatest(
           date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires'))::date,
           coalesce(date_trunc('month', max(coalesce(c.fecha_comprobante, c.fecha)))::date, date '2026-10-01'))
    into v_hasta
    from public.hist_comprobantes c
    join public.orders o on o.order_number = c.pedido::text and o.proyecto = 'femway'
   where c.tipo in ('9','7','3') and not c.anulado;

  return array(select g::date
                 from generate_series(date '2026-10-01', v_hasta, interval '1 month') g
                order by g desc);
end;
$function$;
