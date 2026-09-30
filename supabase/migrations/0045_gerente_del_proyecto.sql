-- El gerente de un proyecto ve el proyecto entero: cuánto lleva el proyecto en
-- el período, cada vendedor, cada cliente y cada pedido. Solo de SU proyecto:
-- el gerente de FemWay no ve nada de FEMAVI.
--
-- Cuenta lo mismo que "Mis ventas": lo aprobado en adelante. Lo que está
-- esperando aprobación se muestra aparte y no suma.

alter table public.sellers add column if not exists es_gerente boolean not null default false;

-- Mariano Vega, gerente de FemWay (pedido de Santiago, 30/09/2026).
update public.sellers set es_gerente = true where code = '57' and proyecto = 'femway';

-- El panel necesita saber si mostrar la solapa del equipo.
create or replace function public.seller_perfil(p_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_seller public.sellers%rowtype;
begin
  select * into v_seller from public.sellers where code = v_code;
  return jsonb_build_object('code', v_seller.code, 'name', v_seller.name,
                            'proyecto', v_seller.proyecto, 'es_gerente', v_seller.es_gerente);
end;
$fn$;
revoke all on function public.seller_perfil(text) from public, anon, authenticated;
grant execute on function public.seller_perfil(text) to anon, authenticated;

create or replace function public.seller_equipo(p_token text, p_periodo text default 'ciclo')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_seller  public.sellers%rowtype;
  v_nombres text[];
  v_ciclos  jsonb;
  v_desde   date;
  v_hasta   date;
  v_res     jsonb;
  v_mes     date := date_trunc('month', current_date)::date;
begin
  select v.* into v_seller
    from public.seller_sessions s
    join public.sellers v on v.code = s.seller_code and v.active
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now();
  if not found then
    raise exception 'sesion_vencida' using errcode = 'P0001';
  end if;
  if not v_seller.es_gerente then
    raise exception 'no_es_gerente' using errcode = 'P0001';
  end if;

  -- Qué meses entran: igual que en seller_resumen.
  if p_periodo = 'ciclo_pasado' then
    v_desde := (v_mes - interval '1 month')::date;
    v_hasta := v_desde;
  elsif p_periodo = 'ultimos3' then
    v_desde := (v_mes - interval '2 months')::date;
    v_hasta := v_mes;
  elsif p_periodo = 'anio' then
    v_desde := date_trunc('year', current_date)::date;
    v_hasta := (date_trunc('year', current_date) + interval '11 months')::date;
  else
    v_desde := v_mes;
    v_hasta := v_mes;
  end if;

  select array_agg(public.nombre_de_mes(m::date) order by m),
         coalesce(jsonb_agg(jsonb_build_object(
           'nombre', public.nombre_de_mes(m::date),
           'desde', m::date,
           'hasta', (m + interval '1 month' - interval '1 day')::date) order by m), '[]'::jsonb)
    into v_nombres, v_ciclos
    from generate_series(v_desde, v_hasta, interval '1 month') m;
  v_nombres := coalesce(v_nombres, '{}');

  with vend as (
    select code, name from public.sellers where proyecto = v_seller.proyecto
  ),
  ped as (
    select o.*,
           -- Un mismo cliente puede venir con código, solo con CUIT o solo con nombre.
           coalesce(nullif(ltrim(btrim(o.client_code), '0'), ''),
                    nullif(regexp_replace(coalesce(o.cuit, ''), '\D', '', 'g'), ''),
                    lower(btrim(o.company))) as clave_cliente
      from public.orders o
     where o.proyecto = v_seller.proyecto
       and o.status in ('aprobado', 'ingresado', 'facturado', 'entregado')
       and (
         (v_seller.proyecto = 'femway'
          and public.nombre_de_mes((o.created_at at time zone 'America/Argentina/Buenos_Aires')::date)
              = any(v_nombres))
         or
         (v_seller.proyecto <> 'femway'
          and btrim(coalesce(o.sales_cycle, '')) = any(v_nombres))
       )
  ),
  renglones as (
    select ped.seller_code,
           nullif(btrim(i->>'product'), '') as producto,
           coalesce((i->>'quantity')::numeric, 0) as q
      from ped, jsonb_array_elements(ped.items) i
  ),
  esperando as (
    select * from public.orders
     where proyecto = v_seller.proyecto and status = 'recibido'
  )
  select jsonb_build_object(
    'proyecto', v_seller.proyecto,
    'periodo', p_periodo,
    'ciclos', v_ciclos,
    'totales', jsonb_build_object(
      'pedidos',    (select count(*) from ped),
      'clientes',   (select count(distinct clave_cliente) from ped),
      'pesos',      (select coalesce(sum(total), 0) from ped),
      'volumen',    (select coalesce(sum(q), 0) from renglones),
      'bonificado', (select coalesce(-sum(q), 0) from renglones where q < 0)
    ),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
                     'producto', producto, 'vendido', vendido, 'bonificado', bonificado)
                     order by vendido desc), '[]'::jsonb)
                    from (
                      select producto,
                             coalesce(sum(q) filter (where q > 0), 0)  as vendido,
                             coalesce(-sum(q) filter (where q < 0), 0) as bonificado
                        from renglones where producto is not null
                       group by producto
                    ) pr),
    -- Todos los vendedores del proyecto, aunque no hayan vendido: el que está
    -- en cero también es un dato.
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object(
                      'code', v.code, 'name', v.name,
                      'pedidos', coalesce(x.pedidos, 0), 'clientes', coalesce(x.clientes, 0),
                      'pesos', coalesce(x.pesos, 0), 'volumen', coalesce(r.volumen, 0),
                      'esperando', coalesce(e.n, 0))
                      order by coalesce(x.pesos, 0) desc, lpad(v.code, 6, '0')), '[]'::jsonb)
                     from vend v
                     left join (select seller_code, count(*) as pedidos,
                                       count(distinct clave_cliente) as clientes,
                                       sum(total) as pesos
                                  from ped group by seller_code) x on x.seller_code = v.code
                     left join (select seller_code, sum(q) as volumen
                                  from renglones group by seller_code) r on r.seller_code = v.code
                     left join (select seller_code, count(*) as n
                                  from esperando group by seller_code) e on e.seller_code = v.code),
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object(
                    'cliente', cliente, 'codigo', codigo, 'vendedor', vendedor,
                    'pedidos', pedidos, 'pesos', pesos, 'ultimo', ultimo)
                    order by pesos desc), '[]'::jsonb)
                   from (
                     select (array_agg(company order by created_at desc))[1] as cliente,
                            -- Si el pedido vino sin código, se busca por CUIT en el registro.
                            coalesce((array_agg(client_code order by created_at desc)
                                        filter (where client_code is not null))[1],
                                     case when v_seller.proyecto = 'femway' then
                                       (select f.codigo from public.femway_clientes f
                                         where regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g') = clave_cliente
                                         limit 1) end) as codigo,
                            (array_agg(seller_code order by created_at desc))[1] as vendedor,
                            count(*) as pedidos, sum(total) as pesos,
                            max(created_at) as ultimo
                       from ped group by clave_cliente
                   ) c),
    'esperando', (select count(*) from esperando),
    -- Los del período que ya cuentan, y arriba los que esperan aprobación.
    'pedidos', (select coalesce(jsonb_agg(jsonb_build_object(
                   'numero', order_number, 'fecha', created_at, 'vendedor', seller_code,
                   'cliente', company, 'codigo', client_code, 'total', total,
                   'estado', status) order by (status = 'recibido') desc, created_at desc), '[]'::jsonb)
                  from (select * from (
                          select order_number, created_at, seller_code, company, client_code, total, status from ped
                          union all
                          select order_number, created_at, seller_code, company, client_code, total, status from esperando
                        ) u order by created_at desc limit 500) z)
  ) into v_res;

  return v_res;
end;
$fn$;
revoke all on function public.seller_equipo(text, text) from public, anon, authenticated;
grant execute on function public.seller_equipo(text, text) to anon, authenticated;
