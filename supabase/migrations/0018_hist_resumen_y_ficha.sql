-- Resumen por cliente del historial del sistema viejo. Es una vista materializada:
-- se recalcula con hist_refrescar() después de cada carga. Las ventanas de 12
-- meses se miden desde el día del refresco.
-- Signo: factura (9) suma, nota de crédito (3) resta; tipos 4, 6 y 7 (sin
-- identificar) no suman todavía.
drop materialized view if exists public.hist_resumen_cliente;
create materialized view public.hist_resumen_cliente as
with comp as (
  select c.clave, c.cliente, c.fecha, c.total,
         case c.tipo when '9' then 1 when '3' then -1 else 0 end as signo
    from public.hist_comprobantes c
   where c.fecha between date '1995-01-01' and current_date
),
vol as (
  select r.clave, sum(r.kilos) as kilos from public.hist_renglones r group by r.clave
)
select comp.cliente as codigo,
       min(comp.fecha) filter (where signo = 1)  as primera_compra,
       max(comp.fecha) filter (where signo = 1)  as ultima_compra,
       count(*) filter (where signo = 1)         as compras,
       coalesce(sum(signo * coalesce(vol.kilos, 0)), 0) as volumen,
       coalesce(sum(signo * coalesce(vol.kilos, 0)) filter (where comp.fecha > current_date - 365), 0) as volumen_12m,
       coalesce(sum(signo * coalesce(vol.kilos, 0)) filter (where comp.fecha > current_date - 730
                                                           and comp.fecha <= current_date - 365), 0) as volumen_12m_anterior,
       coalesce(sum(signo * coalesce(comp.total, 0)) filter (where comp.fecha > current_date - 365), 0) as pesos_12m,
       current_date as calculado_el
  from comp left join vol on vol.clave = comp.clave
 group by comp.cliente;
create unique index hist_resumen_cliente_pk on public.hist_resumen_cliente (codigo);

-- Una vista materializada no tiene RLS: nadie la lee directo, solo por las funciones.
revoke all on public.hist_resumen_cliente from public, anon, authenticated;

create or replace function public.hist_refrescar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'no autorizado';
  end if;
  refresh materialized view concurrently public.hist_resumen_cliente;
end;
$fn$;
revoke all on function public.hist_refrescar() from public, anon, authenticated;
grant execute on function public.hist_refrescar() to authenticated;

-- ── Búsqueda de clientes ──
create or replace function public.hist_buscar_clientes(
  p_q        text default null,
  p_vendedor text default null,
  p_zona     text default null,
  p_estado   text default null,      -- 'activos' (compró en 12 meses), 'inactivos', 'sin_compras'
  p_orden    text default 'ultima',  -- 'ultima', 'volumen_12m', 'volumen', 'nombre'
  p_limite   integer default 100,
  p_offset   integer default 0
)
returns table (
  codigo text, razon_social text, cuit text, localidad text, vendedor text, zona text,
  primera_compra date, ultima_compra date, compras bigint,
  volumen numeric, volumen_12m numeric, volumen_12m_anterior numeric, total_filas bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  q text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;

  return query
  select c.codigo, c.razon_social, c.cuit, c.localidad, c.vendedor, c.zona,
         r.primera_compra, r.ultima_compra, coalesce(r.compras, 0),
         coalesce(r.volumen, 0), coalesce(r.volumen_12m, 0), coalesce(r.volumen_12m_anterior, 0),
         count(*) over ()
    from public.hist_clientes c
    left join public.hist_resumen_cliente r on r.codigo = c.codigo
   where (q is null
          or c.razon_social ilike '%' || q || '%'
          or c.localidad ilike '%' || q || '%'
          or (q_digitos is not null and (c.codigo = lpad(q_digitos, 5, '0') or c.cuit like '%' || q_digitos || '%')))
     and (p_vendedor is null or c.vendedor = p_vendedor)
     and (p_zona is null or c.zona = p_zona)
     and (p_estado is null
          or (p_estado = 'activos'     and r.ultima_compra > current_date - 365)
          or (p_estado = 'inactivos'   and r.ultima_compra <= current_date - 365)
          or (p_estado = 'sin_compras' and r.ultima_compra is null))
   order by
     case when p_orden = 'nombre' then c.razon_social end asc,
     case when p_orden = 'volumen_12m' then coalesce(r.volumen_12m, 0) end desc,
     case when p_orden = 'volumen' then coalesce(r.volumen, 0) end desc,
     r.ultima_compra desc nulls last,
     c.razon_social asc
   limit least(greatest(coalesce(p_limite, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$fn$;
revoke all on function public.hist_buscar_clientes(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hist_buscar_clientes(text, text, text, text, text, integer, integer) to authenticated;

-- ── Ficha de un cliente: datos, resumen, volumen por año, productos,
-- comprobantes con sus renglones y pedidos web ──
create or replace function public.hist_ficha_cliente(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_cod text := lpad(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), 5, '0');
  v_res jsonb;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if not exists (select 1 from public.hist_clientes where codigo = v_cod) then return null; end if;

  with comp as (
    select c.*, case c.tipo when '9' then 1 when '3' then -1 else 0 end as signo
      from public.hist_comprobantes c where c.cliente = v_cod
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
                       and ltrim(v_cod, '0') <> '')
  ) into v_res;

  return v_res;
end;
$fn$;
revoke all on function public.hist_ficha_cliente(text) from public, anon, authenticated;
grant execute on function public.hist_ficha_cliente(text) to authenticated;
