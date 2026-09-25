-- Cada proyecto mide distinto, y esto es lo que los separa:
--
--   · FEMAVI, por CICLO. Son mensuales, pero el corte va variando, así que los
--     carga administración a mano y hay que decir a qué ciclo pertenece cada
--     pedido antes de aprobarlo.
--
--   · FemWay, por MES CALENDARIO, del 1 al último día, sin cargar nada. El mes
--     sale de la fecha del pedido, así que el día 1 de cada mes arranca en cero.
--     Un pedido de FemWay se aprueba sin ciclo ninguno.
--
-- Estaba hecho como si los ciclos fueran de los dos. No lo son.

create or replace function public.pedido_exige_ciclo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  -- En FemWay no hay ciclos: el período es el mes y sale solo de la fecha.
  if new.proyecto <> 'femavi' then return new; end if;

  if new.status in ('aprobado', 'ingresado', 'facturado', 'entregado') then
    if nullif(btrim(coalesce(new.sales_cycle, '')), '') is null then
      raise exception 'Antes de aprobar hay que cargar a qué ciclo pertenece el pedido.'
        using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.ciclos where nombre = btrim(new.sales_cycle)) then
      raise exception 'El ciclo "%" no está dado de alta.', btrim(new.sales_cycle)
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists pedido_exige_ciclo on public.orders;
create trigger pedido_exige_ciclo
  before insert or update of status, sales_cycle on public.orders
  for each row execute function public.pedido_exige_ciclo();

-- El conteo de cada ciclo mira solo pedidos de FEMAVI.
create or replace function public.admin_ciclos()
returns table (id bigint, nombre text, desde date, hasta date, es_actual boolean,
               pedidos bigint, pesos numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return query
  select c.id, c.nombre, c.desde, c.hasta,
         (current_date between c.desde and c.hasta) as es_actual,
         count(o.id), coalesce(sum(o.total), 0)
    from public.ciclos c
    left join public.orders o
      on btrim(coalesce(o.sales_cycle, '')) = c.nombre
     and o.proyecto = 'femavi'
     and o.status in ('aprobado', 'ingresado', 'facturado', 'entregado')
   group by c.id, c.nombre, c.desde, c.hasta
   order by c.desde desc;
end;
$fn$;
revoke all on function public.admin_ciclos() from public, anon, authenticated;
grant execute on function public.admin_ciclos() to authenticated;

-- El resumen del vendedor, cada uno con la vara de su proyecto.
create or replace function public.seller_resumen(p_token text, p_periodo text default 'ciclo')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_seller  public.sellers%rowtype;
  v_actual  public.ciclos;
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

  if v_seller.proyecto = 'femway' then
    -- Mes calendario. No hay ciclos que cargar ni con qué equivocarse.
    if p_periodo = 'ciclo_pasado' then
      v_desde := (v_mes - interval '1 month')::date;
      v_hasta := (v_mes - interval '1 day')::date;
    elsif p_periodo = 'ultimos3' then
      v_desde := (v_mes - interval '2 months')::date;
      v_hasta := (v_mes + interval '1 month' - interval '1 day')::date;
    elsif p_periodo = 'anio' then
      v_desde := date_trunc('year', current_date)::date;
      v_hasta := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
    else
      v_desde := v_mes;
      v_hasta := (v_mes + interval '1 month' - interval '1 day')::date;
    end if;

    -- El nombre del mes no puede depender del idioma del servidor.
    select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                              'Agosto','Septiembre','Octubre','Noviembre','Diciembre'])
                              [extract(month from m)::int] || ' ' || to_char(m, 'YYYY'),
             'desde', m::date,
             'hasta', (m + interval '1 month' - interval '1 day')::date) order by m), '[]'::jsonb)
      into v_ciclos
      from generate_series(v_desde, v_hasta, interval '1 month') m;
  else
    select * into v_actual from public.ciclo_actual();
    -- Si hoy no cae en ningún ciclo cargado, se toma el último que terminó.
    if v_actual.id is null then
      select * into v_actual from public.ciclos where hasta < current_date
       order by hasta desc limit 1;
    end if;

    if p_periodo = 'anio' then
      select array_agg(nombre order by desde) into v_nombres
        from public.ciclos where extract(year from desde) = extract(year from current_date);
    elsif v_actual.id is null then
      v_nombres := '{}';
    elsif p_periodo = 'ciclo_pasado' then
      select array_agg(nombre) into v_nombres from (
        select nombre from public.ciclos where desde < v_actual.desde order by desde desc limit 1) x;
    elsif p_periodo = 'ultimos3' then
      select array_agg(nombre) into v_nombres from (
        select nombre from public.ciclos where desde <= v_actual.desde order by desde desc limit 3) x;
    else
      v_nombres := array[v_actual.nombre];
    end if;
    v_nombres := coalesce(v_nombres, '{}');

    select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'desde', desde, 'hasta', hasta)
                    order by desde), '[]'::jsonb)
      into v_ciclos
      from public.ciclos where nombre = any(v_nombres);
  end if;

  with ped as (
    select * from public.orders o
     where o.seller_code = v_seller.code
       and o.status in ('aprobado', 'ingresado', 'facturado', 'entregado')
       and (
         (v_seller.proyecto = 'femway'
          and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date between v_desde and v_hasta)
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
