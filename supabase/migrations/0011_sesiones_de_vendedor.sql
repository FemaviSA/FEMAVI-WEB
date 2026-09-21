-- Sin esto el PIN protegía solo la pantalla: create_order() aceptaba cualquier
-- seller_code, así que se podía cargar un pedido a nombre de cualquier vendedor
-- sin saber su PIN. Ahora el PIN correcto entrega un pase de 30 días, y el
-- vendedor del pedido sale del pase, nunca de lo que mande el navegador.
create table if not exists public.seller_sessions (
  token_hash  text primary key,          -- sha256 del pase; el pase en sí nunca se guarda
  seller_code text not null references public.sellers(code) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
alter table public.seller_sessions enable row level security;
revoke all on public.seller_sessions from anon, authenticated;
create index if not exists seller_sessions_seller_idx on public.seller_sessions (seller_code);

-- ── Validar PIN y entregar el pase ──
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

    return jsonb_build_object('ok', true, 'code', v_seller.code, 'name', v_seller.name, 'token', v_token);
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

-- ── Cerrar sesión: el pase deja de servir en el acto ──
create or replace function public.end_seller_session(p_token text)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $fn$
  delete from public.seller_sessions
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$fn$;

-- ── Guardar pedido ──
drop function if exists public.create_order(jsonb);

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
begin
  -- Con pase: el pedido es de ese vendedor, y el pase tiene que estar vigente y
  -- el vendedor activo. Sin pase: pedido de cliente (/pedidos), sin vendedor.
  if nullif(btrim(coalesce(p_token, '')), '') is not null then
    select s.seller_code into v_seller
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

  -- El total se calcula acá: es lo que se factura, no se toma del navegador.
  select coalesce(sum(coalesce((i->>'quantity')::numeric, 0) * coalesce((i->>'unit_price')::numeric, 0)), 0)
    into v_total
    from jsonb_array_elements(v_items) i;
  if v_total < 0 then
    raise exception 'total_negativo' using errcode = 'P0001';
  end if;

  insert into public.orders (
    order_number, account, sales_cycle, purchase_order, ship_date,
    seller_code, is_new_client,
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

  return jsonb_build_object('id', v_id, 'order_number', v_num);
end;
$fn$;

-- Permisos explícitos. Supabase da execute a anon y authenticated en cada
-- función nueva, así que hay que sacarlo y dar solo lo que corresponde.
revoke all on function public.verify_seller_pin(text, text)  from public, anon, authenticated;
revoke all on function public.end_seller_session(text)       from public, anon, authenticated;
revoke all on function public.create_order(jsonb, text)      from public, anon, authenticated;
grant execute on function public.verify_seller_pin(text, text) to anon, authenticated;
grant execute on function public.end_seller_session(text)      to anon, authenticated;
grant execute on function public.create_order(jsonb, text)     to anon, authenticated;

-- ── Fotos de productos: desde la lista central ──
drop policy if exists images_admin_insert on storage.objects;
drop policy if exists images_admin_update on storage.objects;
drop policy if exists images_admin_delete on storage.objects;
create policy images_admin_insert on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());
create policy images_admin_update on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());
create policy images_admin_delete on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ── Aviso del revisor de Supabase ──
alter function public.set_articles_updated_at() set search_path = public, pg_temp;
