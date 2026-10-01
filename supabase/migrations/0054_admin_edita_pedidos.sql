-- Administración edita un pedido ya cargado, aunque esté aprobado: cuenta,
-- cliente, productos, observaciones, vendedor... Así no hay que tocar la base
-- a mano (Santiago, 01/10/2026). Solo admin: los vendedores no editan.
--
-- No cambia el número ni el estado. El vendedor solo puede pasar a otro del
-- mismo proyecto: un pedido no se muda de FEMAVI a FemWay. El total se
-- recalcula acá. Cada edición queda en order_status_log con quién y qué.
-- No vuelve a mandar el mail.

create or replace function public.admin_editar_pedido(p_id bigint, p jsonb, p_vendedor text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
declare
  v_o        public.orders%rowtype;
  v_items    jsonb := coalesce(p->'items', '[]'::jsonb);
  v_total    numeric;
  v_vend     text := nullif(btrim(coalesce(p_vendedor, '')), '');
  v_comparte text := nullif(btrim(coalesce(p->>'compartido_con', '')), '');
  v_limite   text := public.admin_proyecto();
  v_cambios  text[] := '{}';
  v_nuevo    public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;

  select * into v_o from public.orders where id = p_id for update;
  if not found then raise exception 'pedido_inexistente' using errcode = 'P0001'; end if;
  if v_limite is not null and v_o.proyecto <> v_limite then
    raise exception 'no autorizado';
  end if;

  if v_vend is null or not exists (
       select 1 from public.sellers where code = v_vend and active and proyecto = v_o.proyecto) then
    raise exception 'vendedor_de_otro_proyecto' using errcode = 'P0001';
  end if;
  if v_comparte is not null and (
       v_comparte = v_vend
       or not exists (select 1 from public.sellers
                       where code = v_comparte and active and proyecto = v_o.proyecto)) then
    raise exception 'compartido_invalido' using errcode = 'P0001';
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

  update public.orders set
    account          = nullif(btrim(p->>'account'), ''),
    sales_cycle      = nullif(btrim(p->>'sales_cycle'), ''),
    purchase_order   = nullif(btrim(p->>'purchase_order'), ''),
    ship_date        = left(nullif(btrim(p->>'ship_date'), ''), 60),
    seller_code      = v_vend,
    compartido_con   = v_comparte,
    is_new_client    = coalesce((p->>'is_new_client')::boolean, false),
    client_name      = btrim(coalesce(p->>'client_name', '')),
    client_code      = nullif(btrim(p->>'client_code'), ''),
    company          = nullif(btrim(p->>'company'), ''),
    email            = nullif(lower(btrim(p->>'email')), ''),
    phone            = nullif(btrim(p->>'phone'), ''),
    bill_address     = nullif(btrim(p->>'bill_address'), ''),
    bill_city        = nullif(btrim(p->>'bill_city'), ''),
    tax_condition    = nullif(btrim(p->>'tax_condition'), ''),
    cuit             = nullif(btrim(p->>'cuit'), ''),
    payment_terms    = nullif(btrim(p->>'payment_terms'), ''),
    delivery_address = nullif(btrim(p->>'delivery_address'), ''),
    ship_phone       = nullif(btrim(p->>'ship_phone'), ''),
    ship_city        = nullif(btrim(p->>'ship_city'), ''),
    ship_contact     = nullif(btrim(p->>'ship_contact'), ''),
    carrier          = nullif(btrim(p->>'carrier'), ''),
    zone             = nullif(btrim(p->>'zone'), ''),
    items            = v_items,
    total            = v_total,
    notes            = nullif(btrim(p->>'notes'), ''),
    updated_at       = now()
  where id = p_id
  returning * into v_nuevo;

  -- Qué cambió, en palabras, para el historial del pedido.
  if v_nuevo.account is distinct from v_o.account then
    v_cambios := v_cambios || ('cuenta ' || coalesce(v_o.account, '—') || ' → ' || coalesce(v_nuevo.account, '—'));
  end if;
  if v_nuevo.seller_code is distinct from v_o.seller_code then
    v_cambios := v_cambios || ('vendedor ' || coalesce(v_o.seller_code, '—') || ' → ' || v_nuevo.seller_code);
  end if;
  if v_nuevo.compartido_con is distinct from v_o.compartido_con then
    v_cambios := v_cambios || ('comparte con ' || coalesce(v_o.compartido_con, 'nadie') || ' → ' || coalesce(v_nuevo.compartido_con, 'nadie'));
  end if;
  if v_nuevo.client_code is distinct from v_o.client_code or v_nuevo.company is distinct from v_o.company then
    v_cambios := v_cambios || ('cliente ' || coalesce(v_o.company, '—') || ' → ' || coalesce(v_nuevo.company, '—'));
  end if;
  if v_nuevo.items is distinct from v_o.items then
    v_cambios := v_cambios || 'productos'::text;
  end if;
  if v_nuevo.total is distinct from v_o.total then
    v_cambios := v_cambios || ('total $' || to_char(v_o.total, 'FM999G999G990D00') || ' → $' || to_char(v_nuevo.total, 'FM999G999G990D00'));
  end if;
  if row(v_nuevo.sales_cycle, v_nuevo.purchase_order, v_nuevo.ship_date, v_nuevo.is_new_client,
         v_nuevo.client_name, v_nuevo.email, v_nuevo.phone, v_nuevo.bill_address, v_nuevo.bill_city,
         v_nuevo.tax_condition, v_nuevo.cuit, v_nuevo.payment_terms, v_nuevo.delivery_address,
         v_nuevo.ship_phone, v_nuevo.ship_city, v_nuevo.ship_contact, v_nuevo.carrier, v_nuevo.zone, v_nuevo.notes)
     is distinct from
     row(v_o.sales_cycle, v_o.purchase_order, v_o.ship_date, v_o.is_new_client,
         v_o.client_name, v_o.email, v_o.phone, v_o.bill_address, v_o.bill_city,
         v_o.tax_condition, v_o.cuit, v_o.payment_terms, v_o.delivery_address,
         v_o.ship_phone, v_o.ship_city, v_o.ship_contact, v_o.carrier, v_o.zone, v_o.notes) then
    v_cambios := v_cambios || 'otros datos'::text;
  end if;

  if array_length(v_cambios, 1) > 0 then
    insert into public.order_status_log (order_id, from_status, to_status, changed_by, note)
    values (p_id, v_o.status, v_o.status, auth.jwt() ->> 'email',
            'Pedido editado: ' || array_to_string(v_cambios, ', '));
  end if;

  return jsonb_build_object('id', p_id, 'order_number', v_nuevo.order_number,
                            'cambios', to_jsonb(v_cambios));
end;
$fn$;
revoke all on function public.admin_editar_pedido(bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_editar_pedido(bigint, jsonb, text) to authenticated;
