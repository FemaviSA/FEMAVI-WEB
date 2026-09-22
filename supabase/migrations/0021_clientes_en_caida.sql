-- Clientes que se están cayendo: los que compraban y bajaron o dejaron de comprar.
-- Se agrega al resumen la ventana de 24 a 36 meses atrás (volumen_previo2), para
-- distinguir al que viene cayendo hace rato del que se cayó de golpe.

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
       coalesce(sum(signo * coalesce(vol.kilos, 0)) filter (where comp.fecha > current_date - 1095
                                                           and comp.fecha <= current_date - 730), 0) as volumen_previo2,
       coalesce(sum(signo * coalesce(comp.total, 0)) filter (where comp.fecha > current_date - 365), 0) as pesos_12m,
       current_date as calculado_el
  from comp left join vol on vol.clave = comp.clave
 group by comp.cliente;
create unique index hist_resumen_cliente_pk on public.hist_resumen_cliente (codigo);
revoke all on public.hist_resumen_cliente from public, anon, authenticated;

-- Sin chequeo de permisos: la llaman las funciones de abajo (admin o vendedor).
--  p_tipo: 'perdido'  dejó de comprar en los últimos 12 meses
--          'caida'    sigue comprando pero bajó 40% o más
--          'dormido'  no compra hace más de 2 años
create or replace function public.hist_en_caida_base(
  p_vendedor text, p_zona text, p_tipo text, p_min numeric, p_orden text, p_limite integer, p_offset integer
)
returns table (
  codigo text, razon_social text, localidad text, vendedor text, zona text, telefonos text,
  ultima_compra date, compras bigint, volumen numeric,
  volumen_12m numeric, volumen_12m_anterior numeric, volumen_previo2 numeric,
  perdido numeric, caida_pct numeric, tipo text, total_filas bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  with base as (
    select c.codigo, c.razon_social, c.localidad, c.vendedor, c.zona, c.telefonos,
           r.ultima_compra, coalesce(r.compras, 0) as compras, coalesce(r.volumen, 0) as volumen,
           coalesce(r.volumen_12m, 0) as v12, coalesce(r.volumen_12m_anterior, 0) as vant,
           coalesce(r.volumen_previo2, 0) as vprev2,
           case
             when r.ultima_compra is null then null
             when r.ultima_compra <= current_date - 730 and coalesce(r.volumen, 0) > 0 then 'dormido'
             when coalesce(r.volumen_12m, 0) <= 0 and coalesce(r.volumen_12m_anterior, 0) > 0 then 'perdido'
             when coalesce(r.volumen_12m_anterior, 0) > 0
              and coalesce(r.volumen_12m, 0) <= coalesce(r.volumen_12m_anterior, 0) * 0.6 then 'caida'
           end as tipo
      from public.hist_clientes c
      join public.hist_resumen_cliente r on r.codigo = c.codigo
     where (p_vendedor is null or c.vendedor = p_vendedor)
       and (p_zona is null or c.zona = p_zona)
  ),
  filtrado as (
    -- Para el dormido no hay con qué comparar el último año: se toma lo que llegó a comprar.
    select base.*,
           case when tipo = 'dormido' then volumen else vant - v12 end as perdido,
           case when tipo = 'dormido' then 100
                when vant > 0 then round((1 - v12 / vant) * 100) end as caida_pct
      from base
     where tipo is not null
       and (p_tipo is null or tipo = p_tipo)
  )
  select codigo, razon_social, localidad, vendedor, zona, telefonos,
         ultima_compra, compras, volumen, v12, vant, vprev2,
         perdido, caida_pct, tipo, count(*) over ()
    from filtrado
   where perdido >= coalesce(p_min, 1)
   order by
     case when p_orden = 'ultima' then extract(epoch from ultima_compra) end desc,
     case when p_orden = 'porcentaje' then caida_pct end desc,
     perdido desc
   limit least(greatest(coalesce(p_limite, 50), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$fn$;
revoke all on function public.hist_en_caida_base(text, text, text, numeric, text, integer, integer) from public, anon, authenticated;

create or replace function public.hist_clientes_en_caida(
  p_vendedor text default null, p_zona text default null, p_tipo text default null,
  p_min numeric default null, p_orden text default 'perdido',
  p_limite integer default 50, p_offset integer default 0
)
returns table (
  codigo text, razon_social text, localidad text, vendedor text, zona text, telefonos text,
  ultima_compra date, compras bigint, volumen numeric,
  volumen_12m numeric, volumen_12m_anterior numeric, volumen_previo2 numeric,
  perdido numeric, caida_pct numeric, tipo text, total_filas bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return query select * from public.hist_en_caida_base(p_vendedor, p_zona, p_tipo, p_min, p_orden, p_limite, p_offset);
end;
$fn$;
revoke all on function public.hist_clientes_en_caida(text, text, text, numeric, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hist_clientes_en_caida(text, text, text, numeric, text, integer, integer) to authenticated;

-- El vendedor ve los suyos: el código sale del token, no de un parámetro.
create or replace function public.seller_clientes_en_caida(
  p_token text, p_tipo text default null, p_min numeric default null,
  p_orden text default 'perdido', p_limite integer default 50, p_offset integer default 0
)
returns table (
  codigo text, razon_social text, localidad text, vendedor text, zona text, telefonos text,
  ultima_compra date, compras bigint, volumen numeric,
  volumen_12m numeric, volumen_12m_anterior numeric, volumen_previo2 numeric,
  perdido numeric, caida_pct numeric, tipo text, total_filas bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
begin
  return query select * from public.hist_en_caida_base(lpad(v_code, 3, '0'), null, p_tipo, p_min, p_orden, p_limite, p_offset);
end;
$fn$;
revoke all on function public.seller_clientes_en_caida(text, text, numeric, text, integer, integer) from public, anon, authenticated;
grant execute on function public.seller_clientes_en_caida(text, text, numeric, text, integer, integer) to anon, authenticated;
