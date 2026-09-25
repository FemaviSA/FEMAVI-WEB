-- El cliente de FemWay se da de alta solo con el pedido.
--
-- Casi siempre el cliente de FemWay termina existiendo también en el sistema
-- viejo, porque administración lo tiene que cargar ahí para facturar. Hacer el
-- pase a mano cada vez era la regla en vez de la excepción, que es al revés de
-- como tiene que ser.
--
-- Si el CUIT ya está en el sistema viejo, el cliente de FemWay nace con ESE
-- código y con esos datos, que es la regla de siempre: el 03250 es el 03250 en
-- los dos lados. Si no está, toma un número de la serie propia de FemWay y los
-- datos salen de la planilla.
--
-- Un alta automática NO cuenta como pase aprobado: queda sin fecha de pase, y
-- el control de duplicados sigue avisando en rojo hasta que una persona lo
-- confirme desde Clientes. Para eso está el control.

create or replace function public.femway_cliente_desde_pedido(p_order_id bigint)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  o        public.orders%rowtype;
  v_dig    text;
  v_nombre text;
  v_cod    text;
  v_h      public.hist_clientes%rowtype;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or o.proyecto <> 'femway' then return null; end if;

  v_dig := nullif(regexp_replace(coalesce(o.cuit, ''), '\D', '', 'g'), '');
  v_nombre := public.normalizar_razon(coalesce(o.company, o.client_name));

  -- Si el vendedor puso un código y ya es de FemWay, no hay nada que hacer.
  v_cod := (select f.codigo from public.femway_clientes f
             where f.codigo = lpad(nullif(regexp_replace(coalesce(o.client_code, ''), '\D', '', 'g'), ''), 5, '0'));
  -- Si no, se lo busca por CUIT y después por nombre, para no duplicarlo.
  if v_cod is null and v_dig is not null then
    select f.codigo into v_cod from public.femway_clientes f
     where regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g') = v_dig limit 1;
  end if;
  if v_cod is null and v_nombre is not null and length(v_nombre) >= 4 then
    select f.codigo into v_cod from public.femway_clientes f
     where public.normalizar_razon(f.razon_social) = v_nombre limit 1;
  end if;

  if v_cod is null then
    if v_dig is not null then
      select * into v_h from public.hist_clientes
       where regexp_replace(coalesce(cuit, ''), '\D', '', 'g') = v_dig limit 1;
    end if;

    if v_h.codigo is not null then
      insert into public.femway_clientes (
        codigo, razon_social, cuit, domicilio, localidad, telefonos, resp_compras,
        entrega_domicilio, entrega_localidad, entrega_telefono, zona,
        vendedor, origen, cliente_femavi, pasado_el
      ) values (
        v_h.codigo, v_h.razon_social,
        nullif(btrim(replace(coalesce(v_h.cuit_formateado, v_h.cuit, ''), '*', '')), ''),
        v_h.domicilio, v_h.localidad, v_h.telefonos, v_h.resp_compras,
        coalesce(v_h.entrega_domicilio, v_h.domicilio),
        coalesce(v_h.entrega_localidad, v_h.localidad),
        v_h.entrega_telefono, v_h.zona,
        o.seller_code, 'femavi', v_h.codigo, null
      )
      on conflict (codigo) do nothing;
      v_cod := v_h.codigo;
    else
      v_cod := lpad(nextval('public.femway_cliente_seq')::text, 5, '0');
      insert into public.femway_clientes (
        codigo, razon_social, cuit, domicilio, localidad, telefonos, resp_compras,
        entrega_domicilio, entrega_localidad, entrega_telefono, zona,
        vendedor, origen
      ) values (
        v_cod, coalesce(o.company, o.client_name, 'Sin nombre'), o.cuit,
        o.bill_address, o.bill_city, coalesce(o.phone, o.ship_phone), o.client_name,
        coalesce(o.delivery_address, o.bill_address),
        coalesce(o.ship_city, o.bill_city),
        coalesce(o.ship_phone, o.phone), o.zone,
        o.seller_code, 'nuevo'
      );
    end if;
  end if;

  -- El pedido queda apuntando al cliente, así la ficha lo suma por código.
  update public.orders
     set client_code = ltrim(v_cod, '0')
   where id = o.id
     and nullif(regexp_replace(coalesce(client_code, ''), '\D', '', 'g'), '') is null;

  return v_cod;
end;
$fn$;
revoke all on function public.femway_cliente_desde_pedido(bigint) from public, anon, authenticated;

-- pedido_insertar llama al alta después de guardar el pedido. Solo FemWay: en
-- FEMAVI los clientes son los del sistema viejo y no se tocan desde acá.
-- (La definición completa está en 0034; acá cambia solo el final.)
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
  v_cod   text;
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

  if coalesce(p_proyecto, 'femavi') = 'femway' then
    v_cod := public.femway_cliente_desde_pedido(v_id);
  end if;

  return jsonb_build_object('id', v_id, 'order_number', v_num,
                            'proyecto', coalesce(p_proyecto, 'femavi'),
                            'cliente_femway', v_cod);
end;
$fn$;
revoke all on function public.pedido_insertar(jsonb, text, text) from public, anon, authenticated;

-- El control de duplicados solo se calla con un pase confirmado por una
-- persona; un alta automática no alcanza. (Ver 0036 para la función entera.)
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_controles_pedido';
  if position('f.pasado_el is not null' in d) = 0 then
    d := replace(d, 'where f.origen = ''femavi''',
                    'where f.origen = ''femavi'' and f.pasado_el is not null');
    execute d;
  end if;
end $$;

-- "Traer de FEMAVI" ahora sirve para dos cosas: traerlo por primera vez, o
-- confirmar uno que se dio de alta solo. Al confirmarlo se refrescan sus datos
-- con los del sistema viejo y queda la fecha del pase.
create or replace function public.admin_femway_pasar_cliente(p_codigo text, p_vendedor text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_digitos text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_cod     text;
  v_fila    public.hist_clientes%rowtype;
  v_vend    text := nullif(btrim(coalesce(p_vendedor, '')), '');
  v_ya      public.femway_clientes%rowtype;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_digitos = '' then raise exception 'Falta el código del cliente.'; end if;
  v_cod := lpad(v_digitos, 5, '0');

  select * into v_fila from public.hist_clientes where codigo = v_cod;
  if not found then
    raise exception 'El cliente % no está en el sistema viejo.', v_cod;
  end if;

  if v_vend is not null and not exists (
    select 1 from public.sellers where code = v_vend and proyecto = 'femway' and active
  ) then
    raise exception 'El vendedor % no es un código activo de FemWay.', v_vend;
  end if;

  select * into v_ya from public.femway_clientes where codigo = v_cod;
  if found and v_ya.pasado_el is not null then
    raise exception 'Ese cliente ya está en FemWay.';
  end if;

  insert into public.femway_clientes (
    codigo, razon_social, cuit, domicilio, localidad, telefonos, resp_compras,
    entrega_domicilio, entrega_localidad, entrega_telefono, zona,
    vendedor, origen, cliente_femavi, pasado_el
  ) values (
    v_cod, v_fila.razon_social,
    nullif(btrim(replace(coalesce(v_fila.cuit_formateado, v_fila.cuit, ''), '*', '')), ''),
    v_fila.domicilio, v_fila.localidad, v_fila.telefonos, v_fila.resp_compras,
    coalesce(v_fila.entrega_domicilio, v_fila.domicilio),
    coalesce(v_fila.entrega_localidad, v_fila.localidad),
    v_fila.entrega_telefono, v_fila.zona,
    v_vend, 'femavi', v_cod, current_date
  )
  on conflict (codigo) do update set
    razon_social      = excluded.razon_social,
    cuit              = excluded.cuit,
    domicilio         = excluded.domicilio,
    localidad         = excluded.localidad,
    telefonos         = excluded.telefonos,
    resp_compras      = excluded.resp_compras,
    entrega_domicilio = excluded.entrega_domicilio,
    entrega_localidad = excluded.entrega_localidad,
    entrega_telefono  = excluded.entrega_telefono,
    zona              = excluded.zona,
    vendedor          = coalesce(excluded.vendedor, public.femway_clientes.vendedor),
    origen            = 'femavi',
    cliente_femavi    = excluded.cliente_femavi,
    pasado_el         = current_date,
    updated_at        = now();

  return jsonb_build_object('codigo', v_cod, 'razon_social', v_fila.razon_social,
                            'confirmado', v_ya.codigo is not null);
end;
$fn$;
revoke all on function public.admin_femway_pasar_cliente(text, text) from public, anon, authenticated;
grant execute on function public.admin_femway_pasar_cliente(text, text) to authenticated;
