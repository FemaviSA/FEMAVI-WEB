-- Clientes de FemWay.
--
-- Hasta ahora los clientes de FemWay solo vivían adentro de cada pedido. Acá
-- tienen su propio registro, porque pasa esto: un vendedor que trabaja en los
-- dos proyectos (hoy Nasser, 11 en FEMAVI y 14 en FemWay) decide que un cliente
-- suyo de FEMAVI le compre a FemWay. Ese cliente queda en los dos lados a la
-- vez: sigue siendo el de FEMAVI y nace como cliente de FemWay con los mismos
-- datos.
--
-- El código es el mismo en los dos lados (decisión del 24/09/2026): el 03250 de
-- FEMAVI es el 03250 de FemWay. Los clientes que nacen en FemWay toman números
-- de una serie propia que arranca en 50001, bien arriba del último del sistema
-- viejo (20576), para que nunca se pisen.

create table if not exists public.femway_clientes (
  codigo            text primary key,
  razon_social      text not null,
  cuit              text,
  domicilio         text,
  localidad         text,
  telefonos         text,
  resp_compras      text,
  entrega_domicilio text,
  entrega_localidad text,
  entrega_telefono  text,
  zona              text,
  -- Código del vendedor de FemWay que lo atiende.
  vendedor          text,
  -- 'femavi' = se pasó desde el sistema viejo; 'nuevo' = nació en FemWay.
  origen            text not null check (origen in ('femavi', 'nuevo')),
  -- Código en hist_clientes. Igual a codigo cuando origen = 'femavi'.
  cliente_femavi    text,
  pasado_el         date,
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Sin políticas: no se lee ni se escribe directo, solo por las funciones de abajo.
alter table public.femway_clientes enable row level security;
revoke all on table public.femway_clientes from public, anon, authenticated;

create sequence if not exists public.femway_cliente_seq start with 50001;

create index if not exists femway_clientes_vendedor_idx on public.femway_clientes (vendedor);
create index if not exists femway_clientes_razon_idx
  on public.femway_clientes using gin (razon_social extensions.gin_trgm_ops);

-- ── Pasar un cliente de FEMAVI a FemWay ──
-- Copia los datos del sistema viejo. El cliente no se toca ni se mueve: sigue
-- siendo el de FEMAVI, y además pasa a existir en FemWay con el mismo código.

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

  if exists (select 1 from public.femway_clientes where codigo = v_cod) then
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
  );

  return jsonb_build_object('codigo', v_cod, 'razon_social', v_fila.razon_social);
end;
$fn$;
revoke all on function public.admin_femway_pasar_cliente(text, text) from public, anon, authenticated;
grant execute on function public.admin_femway_pasar_cliente(text, text) to authenticated;

-- ── Alta y edición a mano ──
-- Un cliente que nace en FemWay toma un número de la serie propia; uno que ya
-- está (pasado o no) se edita conservando el suyo.

create or replace function public.admin_femway_guardar_cliente(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_cod  text := nullif(btrim(coalesce(p->>'codigo', '')), '');
  v_raz  text := nullif(btrim(coalesce(p->>'razon_social', '')), '');
  v_vend text := nullif(btrim(coalesce(p->>'vendedor', '')), '');
  v_nuevo boolean;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  if v_raz is null then raise exception 'Falta la razón social.'; end if;
  if v_vend is not null and not exists (
    select 1 from public.sellers where code = v_vend and proyecto = 'femway' and active
  ) then
    raise exception 'El vendedor % no es un código activo de FemWay.', v_vend;
  end if;

  v_nuevo := v_cod is null;
  if v_nuevo then v_cod := lpad(nextval('public.femway_cliente_seq')::text, 5, '0'); end if;

  insert into public.femway_clientes (
    codigo, razon_social, cuit, domicilio, localidad, telefonos, resp_compras,
    entrega_domicilio, entrega_localidad, entrega_telefono, zona,
    vendedor, origen, notas
  ) values (
    v_cod, v_raz,
    nullif(btrim(coalesce(p->>'cuit', '')), ''),
    nullif(btrim(coalesce(p->>'domicilio', '')), ''),
    nullif(btrim(coalesce(p->>'localidad', '')), ''),
    nullif(btrim(coalesce(p->>'telefonos', '')), ''),
    nullif(btrim(coalesce(p->>'resp_compras', '')), ''),
    nullif(btrim(coalesce(p->>'entrega_domicilio', '')), ''),
    nullif(btrim(coalesce(p->>'entrega_localidad', '')), ''),
    nullif(btrim(coalesce(p->>'entrega_telefono', '')), ''),
    nullif(btrim(coalesce(p->>'zona', '')), ''),
    v_vend, 'nuevo',
    nullif(btrim(coalesce(p->>'notas', '')), '')
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
    vendedor          = excluded.vendedor,
    notas             = excluded.notas,
    -- El origen no se pisa: un cliente pasado de FEMAVI sigue siéndolo.
    updated_at        = now();

  return jsonb_build_object('codigo', v_cod, 'nuevo', v_nuevo);
end;
$fn$;
revoke all on function public.admin_femway_guardar_cliente(jsonb) from public, anon, authenticated;
grant execute on function public.admin_femway_guardar_cliente(jsonb) to authenticated;

-- ── Listado para el admin ──

create or replace function public.admin_femway_clientes(p_q text default null, p_vendedor text default null)
returns table (
  codigo text, razon_social text, cuit text, localidad text, telefonos text,
  vendedor text, origen text, pasado_el date, notas text,
  pedidos bigint, ultimo_pedido timestamptz, comprado numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  q text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return query
  select c.codigo, c.razon_social, c.cuit, c.localidad, c.telefonos,
         c.vendedor, c.origen, c.pasado_el, c.notas,
         count(o.id), max(o.created_at), coalesce(sum(o.total), 0)
    from public.femway_clientes c
    left join public.orders o
      on o.proyecto = 'femway' and o.status <> 'rechazado'
     and regexp_replace(coalesce(o.client_code, ''), '\D', '', 'g') = ltrim(c.codigo, '0')
   where (q is null
          or c.razon_social ilike '%' || q || '%'
          or c.localidad ilike '%' || q || '%'
          or (q_digitos is not null and (c.codigo = lpad(q_digitos, 5, '0') or c.cuit like '%' || q_digitos || '%')))
     and (p_vendedor is null or c.vendedor = p_vendedor)
   group by c.codigo, c.razon_social, c.cuit, c.localidad, c.telefonos,
            c.vendedor, c.origen, c.pasado_el, c.notas
   order by c.razon_social;
end;
$fn$;
revoke all on function public.admin_femway_clientes(text, text) from public, anon, authenticated;
grant execute on function public.admin_femway_clientes(text, text) to authenticated;

create or replace function public.admin_femway_borrar_cliente(p_codigo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  delete from public.femway_clientes where codigo = lpad(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), 5, '0');
end;
$fn$;
revoke all on function public.admin_femway_borrar_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_femway_borrar_cliente(text) to authenticated;
