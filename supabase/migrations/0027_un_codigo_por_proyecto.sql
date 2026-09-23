-- Se decidió que cada vendedor tenga un código por proyecto: Roberto entra por
-- el 13 para FEMAVI y por otro código para FemWay. Así el proyecto sale del
-- código con el que inició sesión y no hay nada que elegir ni que equivocar.
--
-- Reemplaza a sellers.proyectos (array), de cuando un mismo código podía
-- trabajar en los dos. Los códigos que hoy existen son todos de FEMAVI.

alter table public.sellers add column if not exists proyecto text not null default 'femavi';
update public.sellers set proyecto = 'femavi';
alter table public.sellers drop constraint if exists sellers_proyecto_check;
alter table public.sellers add constraint sellers_proyecto_check check (proyecto in ('femavi', 'femway'));
alter table public.sellers drop constraint if exists sellers_proyectos_check;
alter table public.sellers drop column if exists proyectos;

grant select (proyecto) on public.sellers to authenticated;

create or replace function public.verify_seller_pin(p_code text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_seller       public.sellers%rowtype;
  v_token        text;
  v_max_attempts constant integer := 5;
  v_lock_minutes constant integer := 15;
begin
  select * into v_seller from public.sellers
   where code = btrim(p_code) and active limit 1;

  if not found then
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_seller.locked_until is not null and v_seller.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'until', v_seller.locked_until);
  end if;

  if v_seller.pin_hash = crypt(p_pin, v_seller.pin_hash) then
    update public.sellers
       set failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
     where id = v_seller.id;

    v_token := encode(gen_random_bytes(32), 'hex');
    insert into public.seller_sessions (token_hash, seller_code, expires_at)
    values (encode(digest(v_token, 'sha256'), 'hex'), v_seller.code, now() + interval '30 days');
    delete from public.seller_sessions where expires_at < now();

    return jsonb_build_object('ok', true, 'code', v_seller.code, 'name', v_seller.name,
                              'token', v_token, 'proyecto', v_seller.proyecto);
  end if;

  update public.sellers
     set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= v_max_attempts
                             then now() + make_interval(mins => v_lock_minutes)
                             else locked_until end,
         updated_at = now()
   where id = v_seller.id;

  perform pg_sleep(0.3);
  return jsonb_build_object('ok', false, 'reason', 'invalid');
end;
$fn$;
revoke all on function public.verify_seller_pin(text, text) from public, anon, authenticated;
grant execute on function public.verify_seller_pin(text, text) to anon, authenticated;

create or replace function public.seller_perfil(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := public.seller_de_token(p_token);
  v_seller public.sellers%rowtype;
begin
  select * into v_seller from public.sellers where code = v_code;
  return jsonb_build_object('code', v_seller.code, 'name', v_seller.name, 'proyecto', v_seller.proyecto);
end;
$fn$;
revoke all on function public.seller_perfil(text) from public, anon, authenticated;
grant execute on function public.seller_perfil(text) to anon, authenticated;

-- El proyecto del pedido sale del vendedor, no de lo que mande el formulario.
create or replace function public.create_order(p jsonb, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_id     bigint;
  v_num    text;
  v_seller text := null;
  v_items  jsonb := coalesce(p->'items', '[]'::jsonb);
  v_total  numeric;
  v_proyecto text := 'femavi';                    -- el formulario público del sitio
begin
  if nullif(btrim(coalesce(p_token, '')), '') is not null then
    select s.seller_code, v.proyecto into v_seller, v_proyecto
      from public.seller_sessions s
      join public.sellers v on v.code = s.seller_code and v.active
     where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
       and s.expires_at > now();
    if v_seller is null then
      raise exception 'sesion_vencida' using errcode = 'P0001';
    end if;
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'pedido_sin_productos' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_items) > 100 then
    raise exception 'pedido_demasiado_largo' using errcode = 'P0001';
  end if;

  select coalesce(sum(coalesce((i->>'quantity')::numeric, 0) * coalesce((i->>'unit_price')::numeric, 0)), 0)
    into v_total
    from jsonb_array_elements(v_items) i;
  if v_total < 0 then
    raise exception 'total_negativo' using errcode = 'P0001';
  end if;

  insert into public.orders (
    order_number, account, sales_cycle, purchase_order, ship_date,
    seller_code, is_new_client, proyecto,
    client_name, client_code, company, email, phone,
    bill_address, bill_city, tax_condition, cuit, payment_terms,
    delivery_address, ship_phone, ship_city, ship_contact, carrier, zone,
    items, total, notes
  ) values (
    nextval('public.order_number_seq')::text,
    nullif(btrim(p->>'account'), ''),
    nullif(btrim(p->>'sales_cycle'), ''),
    nullif(btrim(p->>'purchase_order'), ''),
    nullif(btrim(p->>'ship_date'), '')::date,
    v_seller,
    coalesce((p->>'is_new_client')::boolean, false),
    v_proyecto,
    btrim(coalesce(p->>'client_name', '')),
    nullif(btrim(p->>'client_code'), ''),
    nullif(btrim(p->>'company'), ''),
    nullif(lower(btrim(p->>'email')), ''),
    nullif(btrim(p->>'phone'), ''),
    nullif(btrim(p->>'bill_address'), ''),
    nullif(btrim(p->>'bill_city'), ''),
    nullif(btrim(p->>'tax_condition'), ''),
    nullif(btrim(p->>'cuit'), ''),
    nullif(btrim(p->>'payment_terms'), ''),
    nullif(btrim(p->>'delivery_address'), ''),
    nullif(btrim(p->>'ship_phone'), ''),
    nullif(btrim(p->>'ship_city'), ''),
    nullif(btrim(p->>'ship_contact'), ''),
    nullif(btrim(p->>'carrier'), ''),
    nullif(btrim(p->>'zone'), ''),
    v_items,
    v_total,
    nullif(btrim(p->>'notes'), '')
  )
  returning id, order_number into v_id, v_num;

  return jsonb_build_object('id', v_id, 'order_number', v_num, 'proyecto', v_proyecto);
end;
$fn$;
revoke all on function public.create_order(jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, text) to anon, authenticated;

-- El resumen es el del proyecto de ese código: ya no hace falta pedirlo.
drop function if exists public.seller_summary(text, date, date, text);
create or replace function public.seller_summary(p_token text, p_desde date, p_hasta date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_seller public.sellers%rowtype;
  v_desde  timestamptz;
  v_hasta  timestamptz;
  v_res    jsonb;
begin
  select v.* into v_seller
    from public.seller_sessions s
    join public.sellers v on v.code = s.seller_code and v.active
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now();
  if not found then
    raise exception 'sesion_vencida' using errcode = 'P0001';
  end if;

  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 400 then
    raise exception 'rango_invalido' using errcode = 'P0001';
  end if;

  v_desde := p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_hasta := (p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';

  with ped as (
    select * from public.orders
     where seller_code = v_seller.code
       and created_at >= v_desde and created_at < v_hasta
  ),
  validos as (select * from ped where status <> 'rechazado'),
  renglones as (
    select coalesce((i->>'quantity')::numeric, 0) as q
      from validos, jsonb_array_elements(validos.items) i
  )
  select jsonb_build_object(
    'vendedor', jsonb_build_object('code', v_seller.code, 'name', v_seller.name,
                                   'proyecto', v_seller.proyecto),
    'proyecto', v_seller.proyecto,
    'desde', p_desde,
    'hasta', p_hasta,
    'totales', jsonb_build_object(
      'pedidos',    (select count(*) from validos),
      'clientes',   (select count(distinct coalesce(client_code, lower(company))) from validos),
      'pesos',      (select coalesce(sum(total), 0) from validos),
      'volumen',    (select coalesce(sum(q), 0) from renglones),
      'bonificado', (select coalesce(-sum(q), 0) from renglones where q < 0)
    ),
    'por_estado', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                     from (select status, count(*) as n from ped group by status) x),
    'pedidos', (select coalesce(jsonb_agg(jsonb_build_object(
                    'numero', order_number, 'fecha', created_at, 'cliente', company,
                    'cuenta', account, 'total', total, 'estado', status,
                    'motivo', rejection_reason) order by created_at desc), '[]'::jsonb)
                  from (select * from ped order by created_at desc limit 300) z)
  ) into v_res;

  return v_res;
end;
$fn$;
revoke all on function public.seller_summary(text, date, date) from public, anon, authenticated;
grant execute on function public.seller_summary(text, date, date) to anon, authenticated;

-- Administración de vendedores: un proyecto por código.
drop function if exists public.admin_listar_vendedores();
create or replace function public.admin_listar_vendedores()
returns table (
  code text, name text, active boolean, proyecto text,
  last_login_at timestamptz, locked_until timestamptz, tiene_pin boolean,
  pedidos bigint, ultimo_pedido timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return query
  select s.code, s.name, s.active, s.proyecto, s.last_login_at, s.locked_until,
         s.pin_hash is not null,
         count(o.id), max(o.created_at)
    from public.sellers s
    left join public.orders o on o.seller_code = s.code
   group by s.code, s.name, s.active, s.proyecto, s.last_login_at, s.locked_until, s.pin_hash
   order by s.proyecto, s.code::int;
end;
$fn$;
revoke all on function public.admin_listar_vendedores() from public, anon, authenticated;
grant execute on function public.admin_listar_vendedores() to authenticated;

drop function if exists public.admin_guardar_vendedor(text, text, text[], boolean, text);
create or replace function public.admin_guardar_vendedor(
  p_code text,
  p_name text,
  p_proyecto text default 'femavi',
  p_active boolean default true,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
  v_proy text := lower(btrim(coalesce(p_proyecto, 'femavi')));
  v_hash text := null;
  v_nuevo boolean;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_code !~ '^[0-9]{1,4}$' then raise exception 'El código tiene que ser un número de hasta 4 dígitos.'; end if;
  if length(v_name) < 2 then raise exception 'Falta el nombre del vendedor.'; end if;
  if v_proy not in ('femavi', 'femway') then raise exception 'Proyecto desconocido.'; end if;

  if p_pin is not null then
    if btrim(p_pin) !~ '^[0-9]{4,8}$' then raise exception 'El PIN tiene que ser de 4 a 8 números.'; end if;
    v_hash := crypt(btrim(p_pin), gen_salt('bf'));
  end if;

  select not exists (select 1 from public.sellers where code = v_code) into v_nuevo;
  if v_nuevo and v_hash is null then
    raise exception 'Un vendedor nuevo necesita un PIN.';
  end if;

  insert into public.sellers (code, name, proyecto, active, pin_hash, failed_attempts, locked_until)
  values (v_code, v_name, v_proy, coalesce(p_active, true), v_hash, 0, null)
  on conflict (code) do update set
    name = excluded.name,
    proyecto = excluded.proyecto,
    active = excluded.active,
    pin_hash = coalesce(v_hash, public.sellers.pin_hash),
    failed_attempts = case when v_hash is null then public.sellers.failed_attempts else 0 end,
    locked_until = case when v_hash is null then public.sellers.locked_until else null end,
    updated_at = now();

  if v_hash is not null or coalesce(p_active, true) = false then
    delete from public.seller_sessions where seller_code = v_code;
  end if;

  return jsonb_build_object('code', v_code, 'nuevo', v_nuevo, 'pin_cambiado', v_hash is not null);
end;
$fn$;
revoke all on function public.admin_guardar_vendedor(text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_guardar_vendedor(text, text, text, boolean, text) to authenticated;
