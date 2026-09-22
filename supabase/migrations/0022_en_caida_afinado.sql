-- Afinado de "clientes que se caen" después de mirar los primeros resultados:
-- los dormidos de hace 10 años tapaban todo y sumaban su histórico de décadas.
--  - Se agrega volumen_ultimo_anio: lo que compró en los 12 meses previos a su
--    última compra, o sea a qué ritmo anual venía cuando todavía compraba.
--  - El dormido se mide por ese ritmo, no por su histórico.
--  - El que no compra hace más de 4 años ya no se lista.

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
),
ult as (
  select cliente, max(fecha) filter (where signo = 1) as ultima from comp group by cliente
)
select comp.cliente as codigo,
       min(comp.fecha) filter (where comp.signo = 1)  as primera_compra,
       max(comp.fecha) filter (where comp.signo = 1)  as ultima_compra,
       count(*) filter (where comp.signo = 1)         as compras,
       coalesce(sum(comp.signo * coalesce(vol.kilos, 0)), 0) as volumen,
       coalesce(sum(comp.signo * coalesce(vol.kilos, 0)) filter (where comp.fecha > current_date - 365), 0) as volumen_12m,
       coalesce(sum(comp.signo * coalesce(vol.kilos, 0)) filter (where comp.fecha > current_date - 730
                                                           and comp.fecha <= current_date - 365), 0) as volumen_12m_anterior,
       coalesce(sum(comp.signo * coalesce(vol.kilos, 0)) filter (where comp.fecha > current_date - 1095
                                                           and comp.fecha <= current_date - 730), 0) as volumen_previo2,
       coalesce(sum(comp.signo * coalesce(vol.kilos, 0)) filter (where comp.fecha > ult.ultima - 365), 0) as volumen_ultimo_anio,
       coalesce(sum(comp.signo * coalesce(comp.total, 0)) filter (where comp.fecha > current_date - 365), 0) as pesos_12m,
       current_date as calculado_el
  from comp
  left join vol on vol.clave = comp.clave
  left join ult on ult.cliente = comp.cliente
 group by comp.cliente;
create unique index hist_resumen_cliente_pk on public.hist_resumen_cliente (codigo);
revoke all on public.hist_resumen_cliente from public, anon, authenticated;

-- 'caida'   sigue comprando pero bajó 40% o más contra los 12 meses anteriores
-- 'perdido' dejó de comprar en los últimos 12 meses
-- 'dormido' dejó de comprar hace entre 2 y 4 años (más viejo que eso no se lista)
-- En los tres casos "perdido" son los litros/kg por año que se dejaron de vender.
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
           coalesce(r.volumen_previo2, 0) as vprev2, coalesce(r.volumen_ultimo_anio, 0) as vult,
           case
             when r.ultima_compra is null then null
             when r.ultima_compra <= current_date - 1460 then null
             when r.ultima_compra <= current_date - 730 then 'dormido'
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
    select base.*,
           case when tipo = 'dormido' then vult else vant - v12 end as perdido,
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
