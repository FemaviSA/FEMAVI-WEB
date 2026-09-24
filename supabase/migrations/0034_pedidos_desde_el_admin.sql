-- Cargar pedidos desde el admin.
--
-- Muchos pedidos llegan por mail a santiago@ y ventas@; administración los
-- carga a mano y elige a qué vendedor corresponden, para que le aparezcan en
-- su panel de ventas y cuenten en su estadística.
--
-- El insert estaba dentro de create_order. Se saca a una función de base que
-- usan las dos puertas: el vendedor con su pase, y el admin eligiendo código.

create or replace function public.pedido_insertar(p jsonb, p_seller text, p_proyecto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_id    bigint;
  v_num   text;
  v_items jsonb := coalesce(p->'items', '[]'::jsonb);
  v_total numeric;
begin
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
    p_seller,
    coalesce((p->>'is_new_client')::boolean, false),
    coalesce(p_proyecto, 'femavi'),
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

  return jsonb_build_object('id', v_id, 'order_number', v_num, 'proyecto', coalesce(p_proyecto, 'femavi'));
end;
$fn$;
revoke all on function public.pedido_insertar(jsonb, text, text) from public, anon, authenticated;

-- El vendedor: el código sale del pase, nunca del formulario.
create or replace function public.create_order(p jsonb, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_seller   text := null;
  v_proyecto text := 'femavi';
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
  return public.pedido_insertar(p, v_seller, v_proyecto);
end;
$fn$;
revoke all on function public.create_order(jsonb, text) from public;
grant execute on function public.create_order(jsonb, text) to anon, authenticated;

-- Administración: elige a qué vendedor corresponde el pedido.
create or replace function public.admin_crear_pedido(p jsonb, p_vendedor text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_code     text;
  v_proyecto text;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  select s.code, s.proyecto into v_code, v_proyecto
    from public.sellers s
   where s.code = nullif(btrim(coalesce(p_vendedor, '')), '') and s.active;
  if v_code is null then
    raise exception 'vendedor_inexistente' using errcode = 'P0001';
  end if;
  return public.pedido_insertar(p, v_code, v_proyecto);
end;
$fn$;
revoke all on function public.admin_crear_pedido(jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_crear_pedido(jsonb, text) to authenticated;

-- Los mismos datos que se autocompletan en la planilla del vendedor, pero sin
-- el filtro por cartera: administración carga pedidos de cualquier cliente.
-- Devuelven además el vendedor, para proponerlo al elegir el cliente.
create or replace function public.admin_datos_cliente(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_digitos text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_fila    public.hist_clientes%rowtype;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_digitos = '' then return null; end if;

  select * into v_fila from public.hist_clientes where codigo = lpad(v_digitos, 5, '0');
  if not found then return null; end if;

  return jsonb_build_object(
    'codigo',            v_fila.codigo,
    'company',           v_fila.razon_social,
    'cuit',              nullif(btrim(replace(coalesce(v_fila.cuit_formateado, v_fila.cuit, ''), '*', '')), ''),
    'bill_address',      v_fila.domicilio,
    'bill_city',         v_fila.localidad,
    'phone',             v_fila.telefonos,
    'client_name',       v_fila.resp_compras,
    'delivery_address',  coalesce(v_fila.entrega_domicilio, v_fila.domicilio),
    'ship_city',         coalesce(v_fila.entrega_localidad, v_fila.localidad),
    'ship_phone',        v_fila.entrega_telefono,
    'zone',              v_fila.zona,
    'nota',              nullif(btrim(coalesce(v_fila.otros, '')), ''),
    -- "013" del sistema viejo es el 13 de la web.
    'vendedor',          nullif(ltrim(coalesce(v_fila.vendedor, ''), '0'), '')
  );
end;
$fn$;
revoke all on function public.admin_datos_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_datos_cliente(text) to authenticated;

create or replace function public.admin_buscar_cliente(p_q text)
returns table (codigo text, razon_social text, localidad text, cuit text, vendedor text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  q         text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if q is null or length(q) < 3 then return; end if;

  return query
  select c.codigo, c.razon_social, c.localidad, c.cuit,
         nullif(ltrim(coalesce(c.vendedor, ''), '0'), '')
    from public.hist_clientes c
    left join public.hist_resumen_cliente r on r.codigo = c.codigo
   where c.razon_social ilike '%' || q || '%'
      or (q_digitos is not null and c.cuit like '%' || q_digitos || '%')
   order by r.ultima_compra desc nulls last, c.razon_social
   limit 8;
end;
$fn$;
revoke all on function public.admin_buscar_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_buscar_cliente(text) to authenticated;
