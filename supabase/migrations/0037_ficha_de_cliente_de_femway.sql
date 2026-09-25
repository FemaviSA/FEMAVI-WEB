-- Ficha de un cliente de FemWay: los datos del ABM y lo que compró, igual que
-- la de FEMAVI. La diferencia es de dónde sale la historia: en FEMAVI del
-- sistema viejo, y acá de los pedidos de la web, que es todo lo que hay.
--
-- Un pedido se le atribuye por el código de cliente y, si se cargó como cliente
-- nuevo y quedó sin código, por el CUIT: si no, esa plata no tendría dueño.

create or replace function public.admin_femway_ficha_cliente(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_cod  text;
  v_c    public.femway_clientes%rowtype;
  v_dig  text;
  v_res  jsonb;
  v_anio jsonb;
  v_prod jsonb;
  v_ped  jsonb;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  v_cod := lpad(nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), ''), 5, '0');
  if v_cod is null then return null; end if;

  select * into v_c from public.femway_clientes where codigo = v_cod;
  if not found then return null; end if;
  v_dig := nullif(regexp_replace(coalesce(v_c.cuit, ''), '\D', '', 'g'), '');

  with suyos as (
    select o.id, o.order_number, o.created_at, o.status, o.total, o.seller_code,
           o.account, o.items, o.client_code
      from public.orders o
     where o.proyecto = 'femway'
       and o.status <> 'rechazado'
       and (regexp_replace(coalesce(o.client_code, ''), '\D', '', 'g') = ltrim(v_cod, '0')
            or (nullif(regexp_replace(coalesce(o.client_code, ''), '\D', '', 'g'), '') is null
                and v_dig is not null
                and regexp_replace(coalesce(o.cuit, ''), '\D', '', 'g') = v_dig))
  ),
  renglones as (
    -- Las bonificaciones vienen con cantidad negativa, así que restan solas.
    select s.id, s.created_at,
           nullif(btrim(i->>'product'), '')         as producto,
           coalesce((i->>'quantity')::numeric, 0)   as cantidad,
           coalesce((i->>'line_total')::numeric, 0) as importe
      from suyos s, jsonb_array_elements(coalesce(s.items, '[]'::jsonb)) i
  ),
  resumen as (
    select count(*) as pedidos, coalesce(sum(total), 0) as pesos,
           min(created_at) as primera_compra, max(created_at) as ultima_compra
      from suyos
  ),
  anios as (
    select extract(year from s.created_at)::int as anio,
           count(*) as pedidos, coalesce(sum(s.total), 0) as pesos
      from suyos s group by 1
  ),
  vol_anio as (
    select extract(year from r.created_at)::int as anio, sum(r.cantidad) as volumen
      from renglones r group by 1
  )
  select
    (select jsonb_build_object(
       'pedidos', r.pedidos, 'pesos', r.pesos,
       'volumen', coalesce((select sum(cantidad) from renglones), 0),
       'primera_compra', r.primera_compra, 'ultima_compra', r.ultima_compra)
       from resumen r),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'anio', a.anio, 'pedidos', a.pedidos, 'pesos', a.pesos,
              'volumen', coalesce(v.volumen, 0)) order by a.anio desc), '[]'::jsonb)
       from anios a left join vol_anio v on v.anio = a.anio),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'producto', producto, 'volumen', volumen, 'veces', veces,
              'pesos', pesos, 'ultima_vez', ultima_vez) order by volumen desc), '[]'::jsonb)
       from (
         select producto, sum(cantidad) as volumen, count(distinct id) as veces,
                sum(importe) as pesos, max(created_at) as ultima_vez
           from renglones where producto is not null
          group by producto
       ) p),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', s.id, 'numero', s.order_number, 'fecha', s.created_at,
              'estado', s.status, 'total', s.total, 'vendedor', s.seller_code,
              'cuenta', s.account, 'items', s.items,
              'sin_codigo', nullif(regexp_replace(coalesce(s.client_code, ''), '\D', '', 'g'), '') is null)
            order by s.created_at desc), '[]'::jsonb)
       from suyos s)
  into v_res, v_anio, v_prod, v_ped;

  return jsonb_build_object(
    'cliente', to_jsonb(v_c),
    'resumen', v_res,
    'por_anio', v_anio,
    'productos', v_prod,
    'pedidos', v_ped
  );
end;
$fn$;
revoke all on function public.admin_femway_ficha_cliente(text) from public, anon, authenticated;
grant execute on function public.admin_femway_ficha_cliente(text) to authenticated;

-- Al editar, solo se cambian los campos que vienen. Antes se pisaba todo:
-- mandar media ficha dejaba en blanco el resto, y así se borraron sin querer
-- los datos de un cliente ya cargado. El formulario manda todos los campos, así
-- que sigue pudiendo vaciar uno a propósito.
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

  v_nuevo := v_cod is null or not exists (select 1 from public.femway_clientes where codigo = v_cod);
  if v_cod is null then v_cod := lpad(nextval('public.femway_cliente_seq')::text, 5, '0'); end if;

  if v_nuevo then
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
    );
  else
    update public.femway_clientes f set
      razon_social      = v_raz,
      cuit              = case when p ? 'cuit'              then nullif(btrim(coalesce(p->>'cuit', '')), '')              else f.cuit end,
      domicilio         = case when p ? 'domicilio'         then nullif(btrim(coalesce(p->>'domicilio', '')), '')         else f.domicilio end,
      localidad         = case when p ? 'localidad'         then nullif(btrim(coalesce(p->>'localidad', '')), '')         else f.localidad end,
      telefonos         = case when p ? 'telefonos'         then nullif(btrim(coalesce(p->>'telefonos', '')), '')         else f.telefonos end,
      resp_compras      = case when p ? 'resp_compras'      then nullif(btrim(coalesce(p->>'resp_compras', '')), '')      else f.resp_compras end,
      entrega_domicilio = case when p ? 'entrega_domicilio' then nullif(btrim(coalesce(p->>'entrega_domicilio', '')), '') else f.entrega_domicilio end,
      entrega_localidad = case when p ? 'entrega_localidad' then nullif(btrim(coalesce(p->>'entrega_localidad', '')), '') else f.entrega_localidad end,
      entrega_telefono  = case when p ? 'entrega_telefono'  then nullif(btrim(coalesce(p->>'entrega_telefono', '')), '')  else f.entrega_telefono end,
      zona              = case when p ? 'zona'              then nullif(btrim(coalesce(p->>'zona', '')), '')              else f.zona end,
      notas             = case when p ? 'notas'             then nullif(btrim(coalesce(p->>'notas', '')), '')             else f.notas end,
      vendedor          = case when p ? 'vendedor'          then v_vend                                                   else f.vendedor end,
      updated_at        = now()
    where f.codigo = v_cod;
  end if;

  return jsonb_build_object('codigo', v_cod, 'nuevo', v_nuevo);
end;
$fn$;
revoke all on function public.admin_femway_guardar_cliente(jsonb) from public, anon, authenticated;
grant execute on function public.admin_femway_guardar_cliente(jsonb) to authenticated;
