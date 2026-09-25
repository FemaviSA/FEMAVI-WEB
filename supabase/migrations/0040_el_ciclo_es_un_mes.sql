-- El ciclo de venta es un MES, en los dos proyectos. La diferencia es de dónde
-- sale:
--
--   · FEMAVI: lo elige administración al aprobar el pedido, de un desplegable
--     con los meses. El corte del ciclo va variando y no coincide con el
--     calendario, así que no se puede deducir de la fecha. Sin ciclo elegido no
--     se aprueba.
--
--   · FemWay: sale de la fecha del pedido. Es el mes calendario, del 1 al último
--     día, y el día 1 de cada mes arranca en cero. No hay nada que elegir.
--
-- Y "Mis ventas" cuenta recién cuando el pedido está aprobado: cargarlo no es
-- venderlo. Antes de eso no figura en ningún número ni en la lista; lo único que
-- se le dice al vendedor es cuántos tiene esperando.

-- El nombre del mes, igual del lado de la base y del navegador.
create or replace function public.nombre_de_mes(p_fecha date)
returns text
language sql
immutable
as $fn$
  select (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                'Agosto','Septiembre','Octubre','Noviembre','Diciembre'])
           [extract(month from p_fecha)::int] || ' ' || to_char(p_fecha, 'YYYY');
$fn$;

-- Va como trigger y no como validación de pantalla: así vale para cualquier
-- camino que cambie el estado, no solo para el botón del admin.
create or replace function public.pedido_exige_ciclo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.proyecto <> 'femavi' then return new; end if;
  if new.status in ('aprobado', 'ingresado', 'facturado', 'entregado')
     and nullif(btrim(coalesce(new.sales_cycle, '')), '') is null then
    raise exception 'Antes de aprobar hay que elegir a qué ciclo pertenece el pedido.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

drop trigger if exists pedido_exige_ciclo on public.orders;
create trigger pedido_exige_ciclo
  before insert or update of status, sales_cycle on public.orders
  for each row execute function public.pedido_exige_ciclo();

-- El resumen del vendedor. Reemplaza a seller_summary, que medía por rango de
-- fechas y contaba los pedidos sin aprobar.
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
    select coalesce((i->>'quantity')::numeric, 0) as q
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

-- Hubo un intento anterior con una tabla de ciclos con fechas, cargados a mano.
-- Sobraba: el ciclo es un mes y alcanza con elegir cuál.
drop function if exists public.admin_ciclos();
drop function if exists public.admin_guardar_ciclo(jsonb);
drop function if exists public.admin_borrar_ciclo(bigint);
drop function if exists public.ciclo_actual();
drop table if exists public.ciclos;
