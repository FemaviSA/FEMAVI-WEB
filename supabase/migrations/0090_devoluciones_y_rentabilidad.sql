-- Devoluciones de pedidos aprobados y rentabilidad por vendedor de FemWay.
--
-- Devuelto no es rechazado: rechazado es lo que administración frena antes de
-- que salga; devuelto es lo que salió y el cliente devolvió (una muestra, una
-- prueba de 20 L que no le sirvió). El pedido sigue aprobado y lleva una o más
-- devoluciones, parciales o totales, renglón por renglón.
--
-- La devolución resta en el mes en que se hace, no en el del pedido: un mes
-- cerrado no cambia, y un mes puede quedar en negativo (como en el sistema viejo).
--
-- La rentabilidad va por pedidos aprobados (no por lo facturado), a costo de la
-- lista de Quimwey. Lo sin cargo se muestra aparte y no resta del margen.

-- ── Devoluciones ──
create table if not exists public.order_devoluciones (
  id         bigserial primary key,
  order_id   bigint not null references public.orders(id) on delete cascade,
  fecha      date not null,
  -- [{idx, product, quantity (L/kg devueltos, > 0), unit_price (precio efectivo), line_total}]
  items      jsonb not null,
  total      numeric not null,
  nota       text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists order_devoluciones_order on public.order_devoluciones(order_id);
create index if not exists order_devoluciones_fecha on public.order_devoluciones(fecha);
alter table public.order_devoluciones enable row level security;
revoke all on public.order_devoluciones from public, anon, authenticated;

-- El admin puede tocar un pedido si ve todo el panel o si es de su proyecto.
create or replace function public.admin_puede_pedido(p_order_id bigint)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.is_admin()
     and exists (select 1 from public.orders o
                  where o.id = p_order_id
                    and (public.admin_proyecto() is null or public.admin_proyecto() = o.proyecto));
$$;
revoke all on function public.admin_puede_pedido(bigint) from public, anon, authenticated;

-- Precio efectivo de cada renglón: si el pedido trae una bonificación del mismo
-- producto (renglón con cantidad negativa), se reparte. Devolver los 30 L de un
-- pedido de 30 con 5 bonificados devuelve lo que se cobró, no los 30 a lista.
create or replace function public.pedido_renglones_devolvibles(p_order_id bigint)
returns table(idx int, product text, presentation text, quantity numeric, unit_price numeric,
              precio_efectivo numeric, devuelto numeric, queda numeric)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with it as (
    select (n - 1)::int as idx, i->>'product' as product, i->>'presentation' as presentation,
           coalesce((i->>'quantity')::numeric, 0) as q,
           coalesce((i->>'unit_price')::numeric, 0) as up,
           coalesce((i->>'line_total')::numeric,
                    coalesce((i->>'quantity')::numeric, 0) * coalesce((i->>'unit_price')::numeric, 0)) as lt
      from public.orders o, jsonb_array_elements(o.items) with ordinality as x(i, n)
     where o.id = p_order_id
  ),
  prod as (
    select upper(btrim(product)) as p, sum(lt) as plata, sum(q) filter (where q > 0 and up <> 0) as litros,
           bool_or(q < 0) as hay_bonif
      from it group by 1
  ),
  dev as (
    select (d->>'idx')::int as idx, sum((d->>'quantity')::numeric) as devuelto
      from public.order_devoluciones v, jsonb_array_elements(v.items) d
     where v.order_id = p_order_id group by 1
  )
  select it.idx, it.product, it.presentation, it.q, it.up,
         case when it.up = 0 then 0
              when prod.hay_bonif then round(greatest(prod.plata, 0) / nullif(prod.litros, 0), 4)
              else it.up end,
         coalesce(dev.devuelto, 0),
         it.q - coalesce(dev.devuelto, 0)
    from it
    join prod on prod.p = upper(btrim(it.product))
    left join dev on dev.idx = it.idx
   where it.q > 0
   order by it.idx;
$$;
revoke all on function public.pedido_renglones_devolvibles(bigint) from public, anon, authenticated;

create or replace function public.admin_devoluciones_pedido(p_order_id bigint)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.admin_puede_pedido(p_order_id) then raise exception 'no autorizado'; end if;
  return jsonb_build_object(
    'renglones', (select coalesce(jsonb_agg(to_jsonb(r) order by r.idx), '[]'::jsonb)
                    from public.pedido_renglones_devolvibles(p_order_id) r),
    'devoluciones', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', v.id, 'fecha', v.fecha, 'items', v.items, 'total', v.total,
                        'nota', v.nota, 'created_by', v.created_by, 'created_at', v.created_at)
                      order by v.fecha, v.id), '[]'::jsonb)
                       from public.order_devoluciones v where v.order_id = p_order_id)
  );
end;
$$;
revoke all on function public.admin_devoluciones_pedido(bigint) from public, anon, authenticated;
grant execute on function public.admin_devoluciones_pedido(bigint) to authenticated;

-- p_items: [{idx, quantity}] con los L/kg que volvieron de cada renglón.
create or replace function public.admin_registrar_devolucion(
  p_order_id bigint, p_fecha date, p_items jsonb, p_nota text default null)
returns bigint
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_items jsonb;
  v_total numeric;
  v_malos int;
  v_id    bigint;
begin
  if not public.admin_puede_pedido(p_order_id) then raise exception 'no autorizado'; end if;
  if (select status from public.orders where id = p_order_id) <> 'aprobado' then
    raise exception 'Solo se puede devolver un pedido aprobado';
  end if;
  if p_fecha is null or p_fecha > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'La fecha de la devolución no puede ser futura';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'renglones invalidos'; end if;

  with pedido as (
    select (x->>'idx')::int as idx, (x->>'quantity')::numeric as q
      from jsonb_array_elements(p_items) x
     where coalesce((x->>'quantity')::numeric, 0) <> 0
  )
  select count(*) filter (where r.idx is null or p.q < 0 or p.q > r.queda),
         jsonb_agg(jsonb_build_object(
           'idx', p.idx, 'product', r.product, 'presentation', r.presentation, 'quantity', p.q,
           'unit_price', r.precio_efectivo, 'line_total', round(p.q * r.precio_efectivo, 2))
           order by p.idx),
         sum(round(p.q * r.precio_efectivo, 2))
    into v_malos, v_items, v_total
    from pedido p
    left join public.pedido_renglones_devolvibles(p_order_id) r on r.idx = p.idx;

  if v_items is null then raise exception 'Elegí al menos un renglón y cuánto volvió'; end if;
  if v_malos > 0 then raise exception 'Hay cantidades que superan lo que queda por devolver'; end if;

  insert into public.order_devoluciones (order_id, fecha, items, total, nota, created_by)
  values (p_order_id, p_fecha, v_items, v_total, nullif(btrim(p_nota), ''), auth.jwt() ->> 'email')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_registrar_devolucion(bigint, date, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_registrar_devolucion(bigint, date, jsonb, text) to authenticated;

create or replace function public.admin_borrar_devolucion(p_id bigint)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.admin_puede_pedido((select order_id from public.order_devoluciones where id = p_id)) then
    raise exception 'no autorizado';
  end if;
  delete from public.order_devoluciones where id = p_id;
end;
$$;
revoke all on function public.admin_borrar_devolucion(bigint) from public, anon, authenticated;
grant execute on function public.admin_borrar_devolucion(bigint) to authenticated;

-- ── Qué artículo es cada producto de un pedido web ──
-- El vendedor escribe el producto a mano. Lo que se escribe igual (sin tildes,
-- espacios ni signos) que en la lista de Quimwey o en el sistema viejo se
-- reconoce solo; lo demás se asigna una vez desde la pantalla y queda acá.
create or replace function public.norm_producto(p text)
returns text
language sql immutable
as $$
  select nullif(regexp_replace(translate(upper(coalesce(p, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '[^A-Z0-9]', '', 'g'), '');
$$;

create table if not exists public.producto_articulo (
  clave           text primary key,      -- norm_producto del nombre en el pedido
  nombre          text not null,         -- cómo vino escrito la primera vez
  articulo        text not null,
  actualizado_por text,
  actualizado_at  timestamptz not null default now()
);
alter table public.producto_articulo enable row level security;
revoke all on public.producto_articulo from public, anon, authenticated;

create or replace function public.articulo_de_producto(p text)
returns text
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select articulo from public.producto_articulo where clave = public.norm_producto(p)),
    (select min(articulo) from public.costos_quimwey where public.norm_producto(producto) = public.norm_producto(p)),
    (select min(codigo) from public.hist_articulos where public.norm_producto(descripcion) = public.norm_producto(p)));
$$;
revoke all on function public.articulo_de_producto(text) from public, anon, authenticated;

create or replace function public.admin_asignar_articulo(p_nombre text, p_articulo text)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_admin() or coalesce(public.admin_proyecto(), 'femway') <> 'femway' then
    raise exception 'no autorizado';
  end if;
  if public.norm_producto(p_nombre) is null then raise exception 'producto vacio'; end if;
  if nullif(btrim(p_articulo), '') is null then
    delete from public.producto_articulo where clave = public.norm_producto(p_nombre);
    return;
  end if;
  if not exists (select 1 from public.costos_quimwey where articulo = btrim(p_articulo)) then
    raise exception 'Ese artículo no está en la lista de Quimwey';
  end if;
  insert into public.producto_articulo (clave, nombre, articulo, actualizado_por)
  values (public.norm_producto(p_nombre), btrim(p_nombre), btrim(p_articulo), auth.jwt() ->> 'email')
  on conflict (clave) do update set articulo = excluded.articulo,
    actualizado_por = excluded.actualizado_por, actualizado_at = now();
end;
$$;
revoke all on function public.admin_asignar_articulo(text, text) from public, anon, authenticated;
grant execute on function public.admin_asignar_articulo(text, text) to authenticated;

-- La lista de Quimwey, para elegir el artículo de un producto que no se reconoce.
create or replace function public.admin_lista_quimwey()
returns table(articulo text, producto text, costo numeric)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_admin() or coalesce(public.admin_proyecto(), 'femway') <> 'femway' then
    raise exception 'no autorizado';
  end if;
  return query select k.articulo, k.producto, k.costo from public.costos_quimwey k order by k.producto;
end;
$$;
revoke all on function public.admin_lista_quimwey() from public, anon, authenticated;
grant execute on function public.admin_lista_quimwey() to authenticated;

-- ── Rentabilidad por vendedor de FemWay ──
-- p_vendedor: null = el equipo (sin distribuidores); 'todo' = todos; o un código.
create or replace function public.admin_rentabilidad(p_mes date, p_vendedor text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_desde date := date_trunc('month', coalesce(p_mes, current_date))::date;
  v_hasta date := (date_trunc('month', coalesce(p_mes, current_date)) + interval '1 month - 1 day')::date;
  v_res   jsonb;
begin
  if not public.is_admin() or coalesce(public.admin_proyecto(), 'femway') <> 'femway' then
    raise exception 'no autorizado';
  end if;

  with vend as (
    select s.code, s.es_distribuidor from public.sellers s
     where s.proyecto = 'femway'
       and (case when p_vendedor is null then not s.es_distribuidor
                 when p_vendedor = 'todo' then true
                 else s.code = p_vendedor end)
  ),
  ped as (
    select o.* from public.orders o join vend on vend.code = o.seller_code
     where o.proyecto = 'femway' and o.status = 'aprobado'
       and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date between v_desde and v_hasta
  ),
  it as (
    select btrim(i->>'product') as nombre,
           coalesce((i->>'quantity')::numeric, 0) as q,
           coalesce((i->>'unit_price')::numeric, 0) as up,
           coalesce((i->>'line_total')::numeric,
                    coalesce((i->>'quantity')::numeric, 0) * coalesce((i->>'unit_price')::numeric, 0)) as lt
      from ped, jsonb_array_elements(ped.items) i
  ),
  -- Devoluciones hechas en el mes, de pedidos del vendedor de cualquier mes.
  dev as (
    select v.fecha, o.order_number, o.company, o.created_at, btrim(d->>'product') as nombre,
           (d->>'quantity')::numeric as q, (d->>'line_total')::numeric as lt
      from public.order_devoluciones v
      join public.orders o on o.id = v.order_id and o.proyecto = 'femway'
      join vend on vend.code = o.seller_code
      cross join jsonb_array_elements(v.items) d
     where v.fecha between v_desde and v_hasta
  ),
  -- Venta: lo que se cobra (la bonificación resta plata, no litros: salió igual).
  movs as (
    select nombre, 'venta' as k, case when q > 0 then q else 0 end as q, lt from it where up <> 0
    union all select nombre, 'sin_cargo', q, 0 from it where up = 0 and q > 0
    union all select nombre, 'devolucion', -q, -lt from dev
  ),
  con_art as (
    select m.*, public.articulo_de_producto(m.nombre) as articulo from movs m
  ),
  prod as (
    select coalesce(c.articulo, '?' || public.norm_producto(c.nombre)) as clave,
           c.articulo, coalesce(max(k.producto), max(c.nombre)) as producto, max(k.costo) as costo,
           sum(c.q) filter (where c.k = 'venta') as vendio,
           -sum(c.q) filter (where c.k = 'devolucion') as devolvio,
           sum(c.q) filter (where c.k <> 'sin_cargo') as neto,
           sum(c.lt) filter (where c.k <> 'sin_cargo') as venta,
           sum(c.q) filter (where c.k = 'sin_cargo') as sin_cargo
      from con_art c left join public.costos_quimwey k on k.articulo = c.articulo
     group by 1, 2
  ),
  filas as (
    select p.*, p.neto * p.costo as tot_costo, p.sin_cargo * p.costo as costo_sin_cargo from prod p
  )
  select jsonb_build_object(
    'mes', v_desde, 'desde', v_desde, 'hasta', v_hasta, 'vendedor', p_vendedor,
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object(
                      'code', s.code, 'name', s.name, 'es_distribuidor', s.es_distribuidor, 'active', s.active)
                    order by s.es_distribuidor, s.name), '[]'::jsonb)
                     from public.sellers s where s.proyecto = 'femway'),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
                     'articulo', articulo, 'producto', producto, 'vendio', coalesce(vendio, 0),
                     'devolvio', coalesce(devolvio, 0), 'neto', coalesce(neto, 0), 'venta', coalesce(venta, 0),
                     'precio_prom', case when coalesce(neto, 0) > 0 then round(venta / neto, 2) end,
                     'costo', costo, 'tot_costo', tot_costo)
                   order by coalesce(venta, 0) desc), '[]'::jsonb)
                    from filas where coalesce(vendio, 0) <> 0 or coalesce(devolvio, 0) <> 0),
    'sin_cargo', (select coalesce(jsonb_agg(jsonb_build_object(
                     'articulo', articulo, 'producto', producto, 'cantidad', sin_cargo,
                     'costo', costo, 'tot_costo', costo_sin_cargo) order by producto), '[]'::jsonb)
                    from filas where coalesce(sin_cargo, 0) > 0),
    'devoluciones', (select coalesce(jsonb_agg(jsonb_build_object(
                        'fecha', fecha, 'pedido', order_number, 'cliente', company,
                        'mes_pedido', date_trunc('month', created_at at time zone 'America/Argentina/Buenos_Aires')::date,
                        'producto', nombre, 'cantidad', q, 'importe', lt) order by fecha, order_number), '[]'::jsonb)
                       from dev),
    -- Productos que no se sabe qué artículo son: sin costo hasta asignarlos.
    'sin_articulo', (select coalesce(jsonb_agg(distinct nombre), '[]'::jsonb)
                       from con_art where articulo is null),
    'totales', jsonb_build_object(
      'neto', coalesce((select sum(neto) from filas), 0),
      'venta', coalesce((select sum(venta) from filas), 0),
      'costo', coalesce((select sum(tot_costo) from filas), 0),
      'sin_costo', (select count(*) from filas where costo is null and coalesce(neto, 0) <> 0),
      'devuelto', coalesce((select sum(lt) from dev), 0),
      'sin_cargo_cantidad', coalesce((select sum(sin_cargo) from filas), 0),
      'sin_cargo_costo', coalesce((select sum(costo_sin_cargo) from filas), 0),
      'pedidos', (select count(*) from ped),
      'compartidos', (select count(*) from ped where nullif(btrim(compartido_con), '') is not null)
    )
  ) into v_res;
  return v_res;
end;
$$;
revoke all on function public.admin_rentabilidad(date, text) from public, anon, authenticated;
grant execute on function public.admin_rentabilidad(date, text) to authenticated;
