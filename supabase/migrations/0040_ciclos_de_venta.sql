-- Los ciclos de venta.
--
-- Los vendedores miden por ciclo, no por mes calendario. Los ciclos no siguen
-- una regla fija, así que los carga administración a mano. El pedido guarda el
-- NOMBRE del ciclo en sales_cycle, que es lo que ya se ve en la planilla y en
-- el Excel del mail.
--
-- Y dos cambios que van juntos con esto:
--   · "Mis ventas" cuenta recién cuando el pedido está aprobado. Cargarlo no es
--     venderlo. Antes de eso no figura en ningún número ni en la lista; lo único
--     que se le dice al vendedor es cuántos tiene esperando.
--   · Para aprobar hay que decir a qué ciclo pertenece el pedido. Va como
--     trigger y no como validación de pantalla, así vale para cualquier camino
--     que cambie el estado.

create table if not exists public.ciclos (
  id         bigserial primary key,
  nombre     text not null unique,
  desde      date not null,
  hasta      date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ciclos_fechas_check check (hasta >= desde),
  -- Dos ciclos no se pueden pisar: si no, "este ciclo" sería ambiguo.
  constraint ciclos_sin_superponer exclude using gist (daterange(desde, hasta, '[]') with &&)
);

alter table public.ciclos enable row level security;
revoke all on table public.ciclos from public, anon, authenticated;

create or replace function public.ciclo_actual()
returns public.ciclos
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select c.* from public.ciclos c
   where current_date between c.desde and c.hasta
   order by c.desde desc
   limit 1;
$fn$;
revoke all on function public.ciclo_actual() from public, anon, authenticated;

create or replace function public.pedido_exige_ciclo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
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

-- ── ABM de ciclos ──

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
     and o.status in ('aprobado', 'ingresado', 'facturado', 'entregado')
   group by c.id, c.nombre, c.desde, c.hasta
   order by c.desde desc;
end;
$fn$;
revoke all on function public.admin_ciclos() from public, anon, authenticated;
grant execute on function public.admin_ciclos() to authenticated;

-- Si se le cambia el nombre, los pedidos que ya lo tenían se actualizan solos:
-- si no, quedarían apuntando a un ciclo que no existe y el trigger los trabaría.
create or replace function public.admin_guardar_ciclo(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id     bigint := nullif(p->>'id', '')::bigint;
  v_nombre text   := nullif(btrim(coalesce(p->>'nombre', '')), '');
  v_desde  date   := nullif(p->>'desde', '')::date;
  v_hasta  date   := nullif(p->>'hasta', '')::date;
  v_antes  text;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_nombre is null then raise exception 'Falta el nombre del ciclo.'; end if;
  if v_desde is null or v_hasta is null then raise exception 'Faltan las fechas del ciclo.'; end if;
  if v_hasta < v_desde then raise exception 'El ciclo termina antes de empezar.'; end if;

  if v_id is null then
    insert into public.ciclos (nombre, desde, hasta) values (v_nombre, v_desde, v_hasta)
    returning id into v_id;
  else
    select nombre into v_antes from public.ciclos where id = v_id;
    if v_antes is null then raise exception 'Ese ciclo no existe.'; end if;
    update public.ciclos
       set nombre = v_nombre, desde = v_desde, hasta = v_hasta, updated_at = now()
     where id = v_id;
    if v_antes <> v_nombre then
      update public.orders set sales_cycle = v_nombre
       where btrim(coalesce(sales_cycle, '')) = v_antes;
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'nombre', v_nombre);
end;
$fn$;
revoke all on function public.admin_guardar_ciclo(jsonb) from public, anon, authenticated;
grant execute on function public.admin_guardar_ciclo(jsonb) to authenticated;

create or replace function public.admin_borrar_ciclo(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_nombre text; v_usados int;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  select nombre into v_nombre from public.ciclos where id = p_id;
  if v_nombre is null then return; end if;
  select count(*) into v_usados from public.orders
   where btrim(coalesce(sales_cycle, '')) = v_nombre;
  if v_usados > 0 then
    raise exception 'No se puede borrar: hay % pedido(s) en ese ciclo.', v_usados;
  end if;
  delete from public.ciclos where id = p_id;
end;
$fn$;
revoke all on function public.admin_borrar_ciclo(bigint) from public, anon, authenticated;
grant execute on function public.admin_borrar_ciclo(bigint) to authenticated;

-- ── El resumen del vendedor, medido por ciclo ──
-- El pedido entra al ciclo que le puso administración al aprobarlo, no al que
-- diga la fecha en que se cargó. Reemplaza a seller_summary, que medía por
-- rango de fechas.

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
  v_res     jsonb;
begin
  select v.* into v_seller
    from public.seller_sessions s
    join public.sellers v on v.code = s.seller_code and v.active
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now();
  if not found then
    raise exception 'sesion_vencida' using errcode = 'P0001';
  end if;

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

  with ped as (
    select * from public.orders
     where seller_code = v_seller.code
       and btrim(coalesce(sales_cycle, '')) = any(v_nombres)
       and status in ('aprobado', 'ingresado', 'facturado', 'entregado')
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
