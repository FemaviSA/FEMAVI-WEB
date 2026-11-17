-- Las consultas que leen el histórico ahora saltean los anulados, y la vista
-- del resumen por cliente también (de ahí salen la ficha, los listados y
-- "clientes que se están cayendo").

-- ── 1. El resumen por cliente ──
drop materialized view if exists public.hist_resumen_cliente;
create materialized view public.hist_resumen_cliente as
with comp as (
  select c.clave, c.cliente, c.fecha, c.total,
         case c.tipo when '9' then 1 when '3' then -1 else 0 end as signo
    from public.hist_comprobantes c
   where c.fecha >= date '1995-01-01' and c.fecha <= current_date
     and not c.anulado
), vol as (
  select r.clave, sum(r.kilos) as kilos from public.hist_renglones r group by r.clave
), ult as (
  select comp.cliente, max(comp.fecha) filter (where comp.signo = 1) as ultima
    from comp group by comp.cliente
), huecos as (
  select comp.cliente,
         comp.fecha - lag(comp.fecha) over (partition by comp.cliente order by comp.fecha) as dias
    from comp
   where comp.signo = 1 and comp.fecha > current_date - 1095
), ritmo as (
  select huecos.cliente,
         percentile_cont(0.5) within group (order by huecos.dias::double precision)::integer as dias_tipicos,
         count(huecos.dias) as intervalos
    from huecos
   where huecos.dias is not null and huecos.dias > 0
   group by huecos.cliente
)
select comp.cliente as codigo,
       min(comp.fecha) filter (where comp.signo = 1) as primera_compra,
       max(comp.fecha) filter (where comp.signo = 1) as ultima_compra,
       count(*) filter (where comp.signo = 1) as compras,
       coalesce(sum(comp.signo::numeric * coalesce(vol.kilos, 0)), 0) as volumen,
       coalesce(sum(comp.signo::numeric * coalesce(vol.kilos, 0))
                filter (where comp.fecha > current_date - 365), 0) as volumen_12m,
       coalesce(sum(comp.signo::numeric * coalesce(vol.kilos, 0))
                filter (where comp.fecha > current_date - 730 and comp.fecha <= current_date - 365), 0) as volumen_12m_anterior,
       coalesce(sum(comp.signo::numeric * coalesce(vol.kilos, 0))
                filter (where comp.fecha > current_date - 1095 and comp.fecha <= current_date - 730), 0) as volumen_previo2,
       coalesce(sum(comp.signo::numeric * coalesce(vol.kilos, 0))
                filter (where comp.fecha > ult.ultima - 365), 0) as volumen_ultimo_anio,
       coalesce(sum(comp.signo::numeric * coalesce(comp.total, 0))
                filter (where comp.fecha > current_date - 365), 0) as pesos_12m,
       max(ritmo.dias_tipicos) as dias_tipicos,
       max(ritmo.intervalos) as intervalos,
       current_date as calculado_el
  from comp
  left join vol on vol.clave = comp.clave
  left join ult on ult.cliente = comp.cliente
  left join ritmo on ritmo.cliente = comp.cliente
 group by comp.cliente;

create unique index hist_resumen_cliente_pk on public.hist_resumen_cliente (codigo);
grant select on public.hist_resumen_cliente to service_role;

-- ── 2. La ficha del cliente ──
create or replace function public.hist_ficha_base(p_codigo text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cod text := lpad(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), 5, '0');
  v_res jsonb;
begin
  if not exists (select 1 from public.hist_clientes where codigo = v_cod) then return null; end if;

  with comp as (
    select c.*, case c.tipo when '9' then 1 when '3' then -1 else 0 end as signo
      from public.hist_comprobantes c where c.cliente = v_cod and not c.anulado
  ),
  ren as (
    select r.*, comp.fecha, comp.signo, a.descripcion
      from comp
      join public.hist_renglones r on r.clave = comp.clave
      left join public.hist_articulos a on a.codigo = r.articulo
  ),
  por_anio_comp as (
    select extract(year from fecha)::int as anio,
           count(*) filter (where signo = 1)  as compras,
           count(*) filter (where signo = -1) as devoluciones,
           coalesce(sum(signo * total), 0)    as pesos
      from comp where fecha between date '1995-01-01' and current_date group by 1
  ),
  por_anio_vol as (
    select extract(year from fecha)::int as anio, coalesce(sum(signo * kilos), 0) as volumen
      from ren where fecha between date '1995-01-01' and current_date group by 1
  )
  select jsonb_build_object(
    'cliente', (select to_jsonb(c) from public.hist_clientes c where c.codigo = v_cod),
    'resumen', (select to_jsonb(r) from public.hist_resumen_cliente r where r.codigo = v_cod),
    'por_anio', (select coalesce(jsonb_agg(jsonb_build_object(
                    'anio', a.anio, 'compras', a.compras, 'devoluciones', a.devoluciones,
                    'pesos', a.pesos, 'volumen', coalesce(v.volumen, 0)) order by a.anio), '[]'::jsonb)
                   from por_anio_comp a left join por_anio_vol v on v.anio = a.anio),
    'productos', (select coalesce(jsonb_agg(x order by x.volumen desc), '[]'::jsonb) from (
        select ren.articulo, max(ren.descripcion) as descripcion,
               sum(ren.signo * ren.kilos) as volumen,
               count(distinct ren.clave) filter (where ren.signo = 1) as veces,
               max(ren.fecha) filter (where ren.signo = 1) as ultima_vez
          from ren where ren.signo <> 0
         group by ren.articulo
        having sum(ren.signo * ren.kilos) > 0
         order by 3 desc
         limit 30) x),
    'comprobantes', (select coalesce(jsonb_agg(x order by x.fecha desc nulls last, x.clave desc), '[]'::jsonb) from (
        select comp.clave, comp.fecha, comp.pedido, comp.comprobante, comp.tipo, comp.total,
               (select coalesce(jsonb_agg(jsonb_build_object(
                         'linea', ren.linea, 'articulo', ren.articulo, 'descripcion', ren.descripcion,
                         'cantidad', ren.cantidad, 'envase', ren.envase, 'kilos', ren.kilos,
                         'precio', ren.precio, 'importe', ren.importe) order by ren.linea), '[]'::jsonb)
                  from ren where ren.clave = comp.clave) as renglones
          from comp
         order by comp.fecha desc nulls last
         limit 1500) x),
    'pedidos_web', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', o.id, 'numero', o.order_number, 'fecha', o.created_at,
                        'estado', o.status, 'total', o.total, 'vendedor', o.seller_code)
                      order by o.created_at desc), '[]'::jsonb)
                      from public.orders o
                     where ltrim(coalesce(o.client_code, ''), '0') = ltrim(v_cod, '0')
                       and ltrim(v_cod, '0') <> ''
                       and o.proyecto = 'femavi'
                       and o.status <> 'rechazado')
  ) into v_res;

  return v_res;
end;
$function$;

-- ── 3. El buscador de clientes ──
-- Cambian dos lugares: el filtro "compró este producto" y el "sin comprar entre
-- dos fechas". Lo demás queda igual que en la 0091.
create or replace function public.hist_buscar_clientes_base(
  p_q text default null, p_vendedor text default null, p_zona text default null,
  p_estado text default null, p_orden text default 'ultima', p_limite integer default 50,
  p_offset integer default 0, p_localidad text default null,
  p_sin_desde date default null, p_sin_hasta date default null,
  p_producto text default null, p_prod_desde date default null, p_prod_hasta date default null,
  p_dejo_producto boolean default false, p_atrasados boolean default false)
returns table(codigo text, razon_social text, cuit text, localidad text, vendedor text, zona text,
              primera_compra date, ultima_compra date, compras bigint, volumen numeric,
              volumen_12m numeric, volumen_12m_anterior numeric, ultima_vez_producto date,
              dias_tipicos integer, dias_sin_comprar integer, atraso numeric, total_filas bigint)
language plpgsql
stable security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  q text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
  prod text := nullif(btrim(coalesce(p_producto, '')), '');
  loc  text := nullif(btrim(coalesce(p_localidad, '')), '');
begin
  return query
  with articulos as (
    select a.codigo from public.hist_articulos a
     where prod is not null
       and (a.codigo = prod or a.descripcion ilike '%' || prod || '%')
  ),
  compras_producto as (
    select c.cliente, max(c.fecha) as ultima_vez
      from public.hist_renglones r
      join articulos x on x.codigo = r.articulo
      join public.hist_comprobantes c on c.clave = r.clave
     where c.tipo = '9' and not c.anulado
       and (p_prod_desde is null or c.fecha >= p_prod_desde)
       and (p_prod_hasta is null or c.fecha <= p_prod_hasta)
     group by c.cliente
  )
  select c.codigo, c.razon_social, c.cuit, c.localidad, c.vendedor, c.zona,
         r.primera_compra, r.ultima_compra, coalesce(r.compras, 0),
         coalesce(r.volumen, 0), coalesce(r.volumen_12m, 0), coalesce(r.volumen_12m_anterior, 0),
         cp.ultima_vez,
         r.dias_tipicos,
         (current_date - r.ultima_compra)::int,
         case when r.dias_tipicos > 0 and r.ultima_compra is not null
              then round((current_date - r.ultima_compra)::numeric / r.dias_tipicos, 1) end,
         count(*) over ()
    from public.hist_clientes c
    left join public.hist_resumen_cliente r on r.codigo = c.codigo
    left join compras_producto cp on cp.cliente = c.codigo
   where (q is null
          or c.razon_social ilike '%' || q || '%'
          or c.localidad ilike '%' || q || '%'
          or (q_digitos is not null and (c.codigo = lpad(q_digitos, 5, '0') or c.cuit like '%' || q_digitos || '%')))
     and (p_vendedor is null or c.vendedor = p_vendedor)
     and (p_zona is null or c.zona = p_zona)
     and (loc is null or c.localidad ilike '%' || loc || '%')
     and (p_estado is null
          or (p_estado = 'activos'     and r.ultima_compra > current_date - 365)
          or (p_estado = 'inactivos'   and r.ultima_compra <= current_date - 365)
          or (p_estado = 'sin_compras' and r.ultima_compra is null))
     and (p_sin_desde is null and p_sin_hasta is null
          or not exists (
            select 1 from public.hist_comprobantes h
             where h.cliente = c.codigo and h.tipo = '9' and not h.anulado
               and (p_sin_desde is null or h.fecha >= p_sin_desde)
               and (p_sin_hasta is null or h.fecha <= p_sin_hasta)))
     and (prod is null or cp.cliente is not null)
     and (not p_dejo_producto or (cp.ultima_vez is not null and cp.ultima_vez <= current_date - 365))
     and (not p_atrasados
          or (r.intervalos >= 2 and r.dias_tipicos > 0 and r.ultima_compra is not null
              and (current_date - r.ultima_compra) > r.dias_tipicos * 1.5))
   order by
     case when p_orden = 'nombre' then c.razon_social end asc,
     case when p_orden = 'producto' then cp.ultima_vez end desc,
     case when p_orden = 'atraso' or p_atrasados
          then (current_date - r.ultima_compra)::numeric / nullif(r.dias_tipicos, 0) end desc nulls last,
     r.ultima_compra desc nulls last,
     c.razon_social asc
   limit least(greatest(coalesce(p_limite, 50), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

-- ── 4. Los artículos sugeridos ──
create or replace function public.hist_articulos_sugeridos(p_q text, p_vendedor text default null)
returns table(codigo text, descripcion text, clientes bigint)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select a.codigo, a.descripcion, count(distinct c.cliente)
    from public.hist_articulos a
    join public.hist_renglones r on r.articulo = a.codigo
    join public.hist_comprobantes c on c.clave = r.clave and c.tipo = '9' and not c.anulado
    join public.hist_clientes cl on cl.codigo = c.cliente
   where a.descripcion ilike '%' || btrim(coalesce(p_q, '')) || '%'
     and length(btrim(coalesce(p_q, ''))) >= 3
     and (p_vendedor is null or cl.vendedor = p_vendedor)
   group by a.codigo, a.descripcion
   order by count(distinct c.cliente) desc
   limit 15;
$function$;
