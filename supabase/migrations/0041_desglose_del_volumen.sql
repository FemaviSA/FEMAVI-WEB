-- El total de litros/kilos se puede abrir y ver de qué está hecho: cuánto se
-- vendió y cuánto se bonificó de cada producto. Por ahora se muestra solo en
-- FemWay; el dato está para los dos.

create or replace function public.seller_resumen(p_token text, p_periodo text default 'ciclo')
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

  -- Qué meses entran, para los dos proyectos por igual.
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

  with ped as (
    select * from public.orders o
     where o.seller_code = v_seller.code
       and o.status in ('aprobado', 'ingresado', 'facturado', 'entregado')
       and (
         -- FemWay: el mes sale de la fecha. FEMAVI: del ciclo que le eligieron.
         (v_seller.proyecto = 'femway'
          and public.nombre_de_mes((o.created_at at time zone 'America/Argentina/Buenos_Aires')::date)
              = any(v_nombres))
         or
         (v_seller.proyecto <> 'femway'
          and btrim(coalesce(o.sales_cycle, '')) = any(v_nombres))
       )
  ),
  renglones as (
    select nullif(btrim(i->>'product'), '') as producto,
           coalesce((i->>'quantity')::numeric, 0) as q
      from ped, jsonb_array_elements(ped.items) i
  )
  select jsonb_build_object(
    'vendedor', jsonb_build_object('code', v_seller.code, 'name', v_seller.name,
                                   'proyecto', v_seller.proyecto),
    'proyecto', v_seller.proyecto,
    'periodo', p_periodo,
    'ciclos', v_ciclos,
    'totales', jsonb_build_object(
      'pedidos',    (select count(*) from ped),
      'clientes',   (select count(distinct coalesce(client_code, lower(company))) from ped),
      'pesos',      (select coalesce(sum(total), 0) from ped),
      'volumen',    (select coalesce(sum(q), 0) from renglones),
      'bonificado', (select coalesce(-sum(q), 0) from renglones where q < 0)
    ),
    -- De qué está hecho el volumen: lo vendido y lo bonificado, producto por
    -- producto. Las bonificaciones vienen con cantidad negativa.
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
                     'producto', producto,
                     'vendido', vendido,
                     'bonificado', bonificado) order by vendido desc), '[]'::jsonb)
                    from (
                      select producto,
                             coalesce(sum(q) filter (where q > 0), 0)  as vendido,
                             coalesce(-sum(q) filter (where q < 0), 0) as bonificado
                        from renglones where producto is not null
                       group by producto
                    ) pr),
    -- Cargados y todavía sin aprobar: no suman, solo avisan que llegaron.
    'esperando', (select count(*) from public.orders
                   where seller_code = v_seller.code and status = 'recibido'),
    'por_estado', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                     from (select status, count(*) as n from ped group by status) x),
    'pedidos', (select coalesce(jsonb_agg(jsonb_build_object(
                    'numero', order_number, 'fecha', created_at, 'cliente', company,
                    'cuenta', account, 'total', total, 'estado', status,
                    'ciclo', sales_cycle, 'motivo', rejection_reason) order by created_at desc), '[]'::jsonb)
                  from (select * from ped order by created_at desc limit 300) z)
  ) into v_res;

  return v_res;
end;
$fn$;
revoke all on function public.seller_resumen(text, text) from public, anon, authenticated;
grant execute on function public.seller_resumen(text, text) to anon, authenticated;
