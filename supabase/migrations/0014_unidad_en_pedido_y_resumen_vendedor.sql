-- create_order: igual que en 0011, más la unidad de cada renglón, tomada del
-- catálogo en el momento del pedido para que el historial no cambie si
-- mañana se edita un producto.
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

  select coalesce(jsonb_agg(
           e.item || jsonb_build_object('unit', coalesce(
             (select pr.unit from public.products pr where pr.slug = e.item->>'slug' limit 1),
             (select pr.unit from public.products pr
               where upper(btrim(pr.name)) = upper(btrim(e.item->>'product')) limit 1)))
           order by e.n), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(v_items) with ordinality as e(item, n);

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

revoke all on function public.create_order(jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, text) to anon, authenticated;

-- ── Resumen del vendedor ──
-- Solo lo suyo: el vendedor sale del pase, no de un parámetro, así que no hay
-- forma de pedir el resumen de otro. Los rechazados aparecen en la lista (con
-- el motivo) pero no suman.
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
     where seller_code = v_seller.code and created_at >= v_desde and created_at < v_hasta
  ),
  validos as (select * from ped where status <> 'rechazado'),
  renglones as (
    select coalesce((i->>'quantity')::numeric, 0) as q, i->>'unit' as u
      from validos, jsonb_array_elements(validos.items) i
  )
  select jsonb_build_object(
    'vendedor', jsonb_build_object('code', v_seller.code, 'name', v_seller.name),
    'desde', p_desde,
    'hasta', p_hasta,
    'totales', jsonb_build_object(
      'pedidos',            (select count(*) from validos),
      'clientes',           (select count(distinct coalesce(client_code, lower(company))) from validos),
      'pesos',              (select coalesce(sum(total), 0) from validos),
      'litros',             (select coalesce(sum(q), 0) from renglones where u = 'L'),
      'kilos',              (select coalesce(sum(q), 0) from renglones where u = 'kg'),
      'unidades',           (select coalesce(sum(q), 0) from renglones where u = 'u'),
      'litros_bonificados', (select coalesce(-sum(q), 0) from renglones where u = 'L'  and q < 0),
      'kilos_bonificados',  (select coalesce(-sum(q), 0) from renglones where u = 'kg' and q < 0),
      'sin_unidad',         (select coalesce(sum(q), 0) from renglones where u is null)
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
