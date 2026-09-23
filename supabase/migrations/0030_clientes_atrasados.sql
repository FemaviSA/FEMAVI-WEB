-- "Atrasados según su propio ritmo": el cliente que compra cada 45 días y hace
-- 600 que no compra aparece, y el que compra cada 6 meses no molesta a los dos
-- meses. Se compara contra su mediana de días entre compras (columna
-- dias_tipicos del resumen, que se calcula sobre los últimos 3 años).
--
-- Criterio: al menos 3 compras en 3 años y un atraso de 1,5 veces su ritmo.
-- Con eso quedan ~200 clientes en toda la base: una lista para llamar, no un
-- listado imposible de trabajar.

drop function if exists public.seller_clientes(text, text, text, text, integer, text, date, date, text, date, date, boolean);
drop function if exists public.hist_buscar_clientes(text, text, text, text, text, integer, integer, text, date, date, text, date, date, boolean);
drop function if exists public.hist_buscar_clientes_base(text, text, text, text, text, integer, integer, text, date, date, text, date, date, boolean);

create or replace function public.hist_buscar_clientes_base(
  p_q          text    default null,
  p_vendedor   text    default null,
  p_zona       text    default null,
  p_estado     text    default null,
  p_orden      text    default 'ultima',
  p_limite     integer default 50,
  p_offset     integer default 0,
  p_localidad  text    default null,
  p_sin_desde  date    default null,
  p_sin_hasta  date    default null,
  p_producto   text    default null,
  p_prod_desde date    default null,
  p_prod_hasta date    default null,
  p_dejo_producto boolean default false,
  p_atrasados  boolean default false
)
returns table (
  codigo text, razon_social text, cuit text, localidad text, vendedor text, zona text,
  primera_compra date, ultima_compra date, compras bigint,
  volumen numeric, volumen_12m numeric, volumen_12m_anterior numeric,
  ultima_vez_producto date,
  dias_tipicos integer, dias_sin_comprar integer, atraso numeric,
  total_filas bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $fn$
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
     where c.tipo = '9'
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
             where h.cliente = c.codigo and h.tipo = '9'
               and (p_sin_desde is null or h.fecha >= p_sin_desde)
               and (p_sin_hasta is null or h.fecha <= p_sin_hasta)))
     and (prod is null or cp.cliente is not null)
     and (not p_dejo_producto or (cp.ultima_vez is not null and cp.ultima_vez <= current_date - 365))
     -- Atrasado contra su propio ritmo, con al menos 3 compras para tener ritmo.
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
$fn$;
revoke all on function public.hist_buscar_clientes_base(text, text, text, text, text, integer, integer, text, date, date, text, date, date, boolean, boolean)
  from public, anon, authenticated;

-- Admin: todos los clientes.
create or replace function public.hist_buscar_clientes(
  p_q text default null, p_vendedor text default null, p_zona text default null,
  p_estado text default null, p_orden text default 'ultima',
  p_limite integer default 50, p_offset integer default 0,
  p_localidad text default null, p_sin_desde date default null, p_sin_hasta date default null,
  p_producto text default null, p_prod_desde date default null, p_prod_hasta date default null,
  p_dejo_producto boolean default false, p_atrasados boolean default false
)
returns table (
  codigo text, razon_social text, cuit text, localidad text, vendedor text, zona text,
  primera_compra date, ultima_compra date, compras bigint,
  volumen numeric, volumen_12m numeric, volumen_12m_anterior numeric,
  ultima_vez_producto date, dias_tipicos integer, dias_sin_comprar integer, atraso numeric,
  total_filas bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return query select * from public.hist_buscar_clientes_base(
    p_q, p_vendedor, p_zona, p_estado, p_orden, p_limite, p_offset,
    p_localidad, p_sin_desde, p_sin_hasta, p_producto, p_prod_desde, p_prod_hasta,
    p_dejo_producto, p_atrasados);
end;
$fn$;
revoke all on function public.hist_buscar_clientes(text, text, text, text, text, integer, integer, text, date, date, text, date, date, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.hist_buscar_clientes(text, text, text, text, text, integer, integer, text, date, date, text, date, date, boolean, boolean)
  to authenticated;

-- Vendedor: solo los suyos.
create or replace function public.seller_clientes(
  p_token text, p_q text default null, p_estado text default null,
  p_orden text default 'ultima', p_offset integer default 0,
  p_localidad text default null, p_sin_desde date default null, p_sin_hasta date default null,
  p_producto text default null, p_prod_desde date default null, p_prod_hasta date default null,
  p_dejo_producto boolean default false, p_atrasados boolean default false
)
returns table (
  codigo text, razon_social text, cuit text, localidad text, vendedor text, zona text,
  primera_compra date, ultima_compra date, compras bigint,
  volumen numeric, volumen_12m numeric, volumen_12m_anterior numeric,
  ultima_vez_producto date, dias_tipicos integer, dias_sin_comprar integer, atraso numeric,
  total_filas bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
begin
  return query select * from public.hist_buscar_clientes_base(
    p_q, lpad(v_code, 3, '0'), null, p_estado, p_orden, 50, p_offset,
    p_localidad, p_sin_desde, p_sin_hasta, p_producto, p_prod_desde, p_prod_hasta,
    p_dejo_producto, p_atrasados);
end;
$fn$;
revoke all on function public.seller_clientes(text, text, text, text, integer, text, date, date, text, date, date, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.seller_clientes(text, text, text, text, integer, text, date, date, text, date, date, boolean, boolean)
  to anon, authenticated;
