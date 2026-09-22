-- Cada vendedor ve SOLO los clientes que tienen su código en el sistema viejo
-- (hist_clientes.vendedor = '013' para el agente 13). El vendedor sale del
-- token de su sesión, nunca de un parámetro, así que no puede pedir otro.
--
-- La lógica de búsqueda y de ficha se mueve a funciones "_base" que no chequean
-- permisos y que nadie puede ejecutar directo: solo las llaman las funciones
-- públicas, que sí chequean (is_admin() o token de vendedor).

-- ── Vendedor a partir del token ──
create or replace function public.seller_de_token(p_token text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_code text;
begin
  select v.code into v_code
    from public.seller_sessions s
    join public.sellers v on v.code = s.seller_code and v.active
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now();
  if v_code is null then
    raise exception 'sesion_vencida' using errcode = 'P0001';
  end if;
  return v_code;
end;
$fn$;
revoke all on function public.seller_de_token(text) from public, anon, authenticated;

-- ── Búsqueda (sin chequeo de permisos) ──
create or replace function public.hist_buscar_clientes_base(
  p_q text, p_vendedor text, p_zona text, p_estado text, p_orden text, p_limite integer, p_offset integer
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
revoke all on function public.hist_buscar_clientes_base(text, text, text, text, text, integer, integer) from public, anon, authenticated;

-- Admin: misma firma y resultado que antes.
create or replace function public.hist_buscar_clientes(
  p_q text default null, p_vendedor text default null, p_zona text default null,
  p_estado text default null, p_orden text default 'ultima',
  p_limite integer default 100, p_offset integer default 0
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
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return query select * from public.hist_buscar_clientes_base(p_q, p_vendedor, p_zona, p_estado, p_orden, p_limite, p_offset);
end;
$fn$;
revoke all on function public.hist_buscar_clientes(text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hist_buscar_clientes(text, text, text, text, text, integer, integer) to authenticated;

-- Vendedor: el filtro de vendedor lo pone la base, no el que llama.
create or replace function public.seller_clientes(
  p_token text, p_q text default null, p_estado text default null,
  p_orden text default 'ultima', p_offset integer default 0
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
  v_code text := public.seller_de_token(p_token);
begin
  return query select * from public.hist_buscar_clientes_base(
    p_q, lpad(v_code, 3, '0'), null, p_estado, p_orden, 50, p_offset);
end;
$fn$;
revoke all on function public.seller_clientes(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.seller_clientes(text, text, text, text, integer) to anon, authenticated;

-- ── Ficha (sin chequeo de permisos) ──
create or replace function public.hist_ficha_base(p_codigo text)
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
revoke all on function public.hist_ficha_base(text) from public, anon, authenticated;

-- Admin: misma firma y resultado que antes.
create or replace function public.hist_ficha_cliente(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return public.hist_ficha_base(p_codigo);
end;
$fn$;
revoke all on function public.hist_ficha_cliente(text) from public, anon, authenticated;
grant execute on function public.hist_ficha_cliente(text) to authenticated;

-- Vendedor: solo si el cliente es suyo. Si no, devuelve null igual que un
-- código inexistente, para no revelar qué clientes existen.
-- De los pedidos web deja solo los que cargó él.
create or replace function public.seller_ficha_cliente(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_cod  text := lpad(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), 5, '0');
  v_res  jsonb;
begin
  if not exists (select 1 from public.hist_clientes
                  where codigo = v_cod and vendedor = lpad(v_code, 3, '0')) then
    return null;
  end if;
  v_res := public.hist_ficha_base(v_cod);
  return jsonb_set(v_res, '{pedidos_web}', coalesce(
    (select jsonb_agg(p) from jsonb_array_elements(v_res->'pedidos_web') p
      where p->>'vendedor' = v_code), '[]'::jsonb));
end;
$fn$;
revoke all on function public.seller_ficha_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_ficha_cliente(text, text) to anon, authenticated;
