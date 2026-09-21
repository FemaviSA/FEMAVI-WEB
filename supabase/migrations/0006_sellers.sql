-- Vendedores que cargan pedidos desde /vendedores/:codigo
create table if not exists public.sellers (
  id              bigint generated always as identity primary key,
  code            text not null unique,
  name            text not null,
  pin_hash        text not null,
  active          boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.sellers is
  'Vendedores que cargan pedidos. El PIN se guarda hasheado con bcrypt: nadie lo lee en claro, ni nosotros.';

-- Sin politicas: RLS bloquea la tabla entera para anon y authenticated.
-- Solo se llega por las funciones security definer de abajo y por service_role.
alter table public.sellers enable row level security;

-- Codigo del vendedor que cargo el pedido. Distinto de client_code,
-- que identifica al cliente al que se le vende.
alter table public.orders add column if not exists seller_code text;

comment on column public.orders.seller_code is
  'Codigo del vendedor que cargo el pedido (sellers.code). No confundir con client_code.';

create index if not exists orders_seller_code_idx on public.orders (seller_code);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);

-- Valida el PIN sin exponer la tabla. Devuelve el nombre del vendedor si
-- coincide. Un codigo inexistente y un PIN equivocado dan la misma respuesta,
-- asi nadie puede ir probando numeros para averiguar que codigos existen.
create or replace function public.verify_seller_pin(p_code text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_seller       public.sellers%rowtype;
  v_max_attempts constant integer := 5;
  v_lock_minutes constant integer := 15;
begin
  select * into v_seller
    from public.sellers
   where code = btrim(p_code) and active
   limit 1;

  if not found then
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_seller.locked_until is not null and v_seller.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'until', v_seller.locked_until);
  end if;

  if v_seller.pin_hash = crypt(p_pin, v_seller.pin_hash) then
    update public.sellers
       set failed_attempts = 0, locked_until = null,
           last_login_at = now(), updated_at = now()
     where id = v_seller.id;
    return jsonb_build_object('ok', true, 'code', v_seller.code, 'name', v_seller.name);
  end if;

  -- PIN equivocado: contamos el intento y bloqueamos 15 minutos a los 5 fallos,
  -- para que nadie pueda ir probando los 999999 PIN posibles desde afuera.
  update public.sellers
     set failed_attempts = failed_attempts + 1,
         locked_until = case
           when failed_attempts + 1 >= v_max_attempts
             then now() + make_interval(mins => v_lock_minutes)
           else locked_until
         end,
         updated_at = now()
   where id = v_seller.id;

  perform pg_sleep(0.3);
  return jsonb_build_object('ok', false, 'reason', 'invalid');
end;
$fn$;

revoke all on function public.verify_seller_pin(text, text) from public;
grant execute on function public.verify_seller_pin(text, text) to anon, authenticated;

-- Alta y cambio de PIN. Solo service_role (el admin desde el servidor):
-- deliberadamente NO se le da permiso a anon.
create or replace function public.set_seller_pin(p_code text, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
begin
  update public.sellers
     set pin_hash = crypt(p_pin, gen_salt('bf')),
         failed_attempts = 0, locked_until = null, updated_at = now()
   where code = btrim(p_code);
end;
$fn$;

revoke all on function public.set_seller_pin(text, text) from public;
