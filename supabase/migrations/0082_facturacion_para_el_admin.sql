-- Hasta ahora la facturación solo se podía leer en la lista de pedidos, con la
-- pestaña puesta en Aprobado y sumando a ojo. Esto la devuelve armada: el
-- período que se pida, los vendedores que se pidan (uno, varios o todos), mes
-- a mes, y abierta por vendedor, por producto y por cliente.
--
-- Factura lo aprobado y nada más. Lo que está esperando —recibido o a
-- confirmar— se devuelve aparte, para saber qué falta y no confundirlo con
-- facturación.

create or replace function public.admin_facturacion(
  p_proyecto   text,
  p_desde      date,
  p_hasta      date,
  -- Códigos de vendedor. Vacío o null = todos los del canal.
  p_vendedores text[] default null,
  -- 'vendedores' (el equipo), 'distribucion' o 'todo'.
  p_canal      text default 'vendedores'
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_proy  text;
  v_canal text := case when p_canal in ('vendedores','distribucion','todo') then p_canal else 'vendedores' end;
  v_vend  text[] := nullif(coalesce(p_vendedores, '{}'), '{}');
  v_desde date := coalesce(p_desde, date_trunc('month', current_date)::date);
  v_hasta date := coalesce(p_hasta, current_date);
  v_res   jsonb;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;

  -- El admin de un solo proyecto mira el suyo, diga lo que diga el pedido.
  v_proy := coalesce(public.admin_proyecto(), p_proyecto, 'femavi');
  if v_proy not in ('femavi','femway') then raise exception 'proyecto invalido'; end if;

  with base as (
    select o.*,
           (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as dia,
           coalesce((select s.es_distribuidor from public.sellers s
                      where s.code = o.seller_code and s.proyecto = o.proyecto), false) as distrib,
           -- Un mismo cliente puede venir con código, solo con CUIT o solo con nombre.
           coalesce(nullif(ltrim(btrim(o.client_code), '0'), ''),
                    nullif(regexp_replace(coalesce(o.cuit, ''), '\D', '', 'g'), ''),
                    lower(btrim(o.company))) as clave_cliente
      from public.orders o
     where o.proyecto = v_proy
       and o.status <> 'rechazado'
       and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date between v_desde and v_hasta
  ),
  filtrado as (
    select * from base
     where (v_canal = 'todo' or distrib = (v_canal = 'distribucion'))
       and (v_vend is null or coalesce(seller_code,'') = any(v_vend))
  ),
  ped as (select * from filtrado where status = 'aprobado'),
  espera as (select * from filtrado where status in ('recibido','a_confirmar')),
  renglones as (
    select ped.seller_code, ped.dia,
           nullif(btrim(i->>'product'), '') as producto,
           coalesce((i->>'quantity')::numeric, 0) as q,
           coalesce((i->>'line_total')::numeric, 0) as importe
      from ped, jsonb_array_elements(ped.items) i
  ),
  por_mes as (
    select date_trunc('month', dia)::date as mes, count(*) as pedidos, sum(total) as pesos
      from ped group by 1
  ),
  volumen_mes as (
    select date_trunc('month', dia)::date as mes, sum(q) as volumen
      from renglones group by 1
  )
  select jsonb_build_object(
    'proyecto', v_proy,
    'canal', v_canal,
    'desde', v_desde,
    'hasta', v_hasta,
    'totales', jsonb_build_object(
      'pedidos',    (select count(*) from ped),
      'clientes',   (select count(distinct clave_cliente) from ped),
      'pesos',      (select coalesce(sum(total), 0) from ped),
      'volumen',    (select coalesce(sum(q), 0) from renglones),
      'bonificado', (select coalesce(-sum(q), 0) from renglones where q < 0)
    ),
    -- Lo que todavía no es facturación, para que se vea qué falta aprobar.
    'esperando', jsonb_build_object(
      'pedidos', (select count(*) from espera),
      'pesos',   (select coalesce(sum(total), 0) from espera),
      'a_confirmar', (select count(*) from espera where status = 'a_confirmar')
    ),
    'meses', (select coalesce(jsonb_agg(jsonb_build_object(
                 'mes', m.mes, 'nombre', public.nombre_de_mes(m.mes),
                 'pedidos', m.pedidos, 'pesos', m.pesos,
                 'volumen', coalesce(v.volumen, 0)) order by m.mes), '[]'::jsonb)
                from por_mes m left join volumen_mes v on v.mes = m.mes),
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object(
                      'code', v.code, 'name', v.name, 'es_distribuidor', v.es_distribuidor,
                      'pedidos', coalesce(x.pedidos, 0), 'clientes', coalesce(x.clientes, 0),
                      'pesos', coalesce(x.pesos, 0), 'volumen', coalesce(r.volumen, 0))
                      order by coalesce(x.pesos, 0) desc, lpad(v.code, 6, '0')), '[]'::jsonb)
                     from public.sellers v
                     left join (select seller_code, count(*) as pedidos,
                                       count(distinct clave_cliente) as clientes, sum(total) as pesos
                                  from ped group by seller_code) x on x.seller_code = v.code
                     left join (select seller_code, sum(q) as volumen
                                  from renglones group by seller_code) r on r.seller_code = v.code
                    where v.proyecto = v_proy
                      and (v_canal = 'todo' or v.es_distribuidor = (v_canal = 'distribucion'))
                      and (v_vend is null or v.code = any(v_vend))),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
                     'producto', producto, 'vendido', vendido, 'bonificado', bonificado, 'pesos', pesos)
                     order by pesos desc), '[]'::jsonb)
                    from (
                      select producto,
                             coalesce(sum(q) filter (where q > 0), 0)  as vendido,
                             coalesce(-sum(q) filter (where q < 0), 0) as bonificado,
                             coalesce(sum(importe), 0) as pesos
                        from renglones where producto is not null group by producto
                    ) pr),
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object(
                    'cliente', cliente, 'codigo', codigo, 'vendedor', vendedor,
                    'pedidos', pedidos, 'pesos', pesos, 'ultimo', ultimo)
                    order by pesos desc), '[]'::jsonb)
                   from (
                     select (array_agg(company order by created_at desc))[1] as cliente,
                            (array_agg(client_code order by created_at desc)
                               filter (where client_code is not null))[1] as codigo,
                            (array_agg(seller_code order by created_at desc))[1] as vendedor,
                            count(*) as pedidos, sum(total) as pesos, max(dia) as ultimo
                       from ped group by clave_cliente
                   ) c)
  ) into v_res;

  return v_res;
end;
$function$;

revoke all on function public.admin_facturacion(text, date, date, text[], text) from public, anon, authenticated;
grant execute on function public.admin_facturacion(text, date, date, text[], text) to authenticated;
