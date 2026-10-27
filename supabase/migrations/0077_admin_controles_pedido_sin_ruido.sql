-- Los controles del pedido, con los criterios nuevos (ver 0076):
--  * "ya es cliente" solo en el primer pedido del cliente en ese proyecto;
--  * "otro pedido web" solo si es por el mismo importe en los últimos 30 días;
--  * la tolerancia de precio sale del cliente cuando tiene descuento acordado.

create or replace function public.admin_controles_pedido(p_order_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  o public.orders%rowtype;
  v_cuit jsonb;
  v_dig text;
  v_nombre text;
  v_dup jsonb;
  v_dup_web jsonb;
  v_vivos int;
  v_otro jsonb;
  v_primera boolean;
  v_tolerancia numeric := 20;
  v_cli_tol numeric;
  v_precios jsonb;
  v_alertas int;
  v_vigencia text;
  v_pase jsonb;
  v_cod_pedido text;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found then return null; end if;

  v_cuit := public.cuit_control(o.cuit);
  v_dig := v_cuit->>'digitos';
  v_nombre := public.normalizar_razon(coalesce(o.company, o.client_name));
  v_cod_pedido := nullif(regexp_replace(coalesce(o.client_code, ''), '\D', '', 'g'), '');

  -- ¿Es el primer pedido de este cliente en este proyecto? Los avisos de
  -- "ya es cliente" solo sirven acá: después el cliente ya es conocido.
  v_primera := not exists (
    select 1 from public.orders p
     where p.id <> o.id
       and p.proyecto = o.proyecto
       and p.status <> 'rechazado'
       and p.created_at < o.created_at
       and ((v_dig is not null and regexp_replace(coalesce(p.cuit, ''), '\D', '', 'g') = v_dig)
            or (v_cod_pedido is not null
                and nullif(regexp_replace(coalesce(p.client_code, ''), '\D', '', 'g'), '') = v_cod_pedido))
  );

  select coalesce(jsonb_agg(to_jsonb(x) order by x.coincide_por, x.parecido desc), '[]'::jsonb),
         count(*) filter (where x.compro_ultimo_anio)
    into v_dup, v_vivos
    from (
      select c.codigo, c.razon_social, c.cuit, c.localidad, c.vendedor, r.ultima_compra,
             (r.ultima_compra > current_date - 365) as compro_ultimo_anio,
             case when v_dig is not null and c.cuit = v_dig then 'cuit' else 'nombre' end as coincide_por,
             round(extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre)::numeric, 2) as parecido,
             (select s.name from public.sellers s
               where lpad(s.code, 3, '0') = lpad(coalesce(c.vendedor, ''), 3, '0') limit 1) as vendedor_nombre,
             (lpad(coalesce(c.vendedor, ''), 3, '0')
                is distinct from lpad(coalesce(o.seller_code, ''), 3, '0')) as otro_vendedor
        from public.hist_clientes c
        left join public.hist_resumen_cliente r on r.codigo = c.codigo
       where (v_dig is not null and c.cuit = v_dig)
       order by case when v_dig is not null and c.cuit = v_dig then 0 else 1 end,
                extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre) desc
       limit 5
    ) x;

  -- El cliente ya existe y figura con otro vendedor: eso se avisa siempre, sea
  -- o no el primer pedido. En FemWay no aplica: el vendedor de FEMAVI es otra
  -- cosa y la contraseña de que el cliente es de uno solo la pone create_order.
  select d into v_otro
    from jsonb_array_elements(v_dup) d
   where (d->>'otro_vendedor')::boolean and o.proyecto = 'femavi'
   limit 1;

  -- Pedido cargado dos veces: mismo cliente y MISMO importe en los últimos 30
  -- días. Que un cliente compre seguido no es un error y no se avisa.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'numero', p.order_number, 'fecha', p.created_at, 'proyecto', p.proyecto,
           'company', p.company, 'cuit', p.cuit, 'vendedor', p.seller_code, 'estado', p.status)
         order by p.created_at desc), '[]'::jsonb) into v_dup_web
    from (
      select * from public.orders p
       where p.id <> o.id
         and p.status <> 'rechazado'
         and p.created_at > o.created_at - interval '30 days'
         and o.total is not null and p.total = o.total
         and ((v_dig is not null and regexp_replace(coalesce(p.cuit, ''), '\D', '', 'g') = v_dig)
              or (v_nombre is not null and length(v_nombre) >= 4
                  and public.normalizar_razon(p.company) = v_nombre))
       order by p.created_at desc
       limit 5
    ) p;

  if o.proyecto = 'femway' then
    select jsonb_build_object('codigo', f.codigo, 'razon_social', f.razon_social,
                              'vendedor', f.vendedor, 'pasado_el', f.pasado_el)
      into v_pase
      from public.femway_clientes f
     where f.origen = 'femavi' and f.pasado_el is not null
       and ((v_cod_pedido is not null and f.codigo = lpad(v_cod_pedido, 5, '0'))
            or (v_dig is not null and regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g') = v_dig))
     limit 1;

    -- El descuento acordado con este cliente, si tiene uno propio.
    select f.descuento_tolerado into v_cli_tol
      from public.femway_clientes f
     where (v_cod_pedido is not null and f.codigo = lpad(v_cod_pedido, 5, '0'))
        or (v_dig is not null and regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g') = v_dig)
     limit 1;
    v_tolerancia := coalesce(v_cli_tol, 20);
  end if;

  -- ── Precios ──
  select max(vigencia) into v_vigencia from public.precios_lista where proyecto = o.proyecto;

  if v_vigencia is null then
    v_precios := jsonb_build_object('estado', 'sin_lista',
      'mensaje', 'No hay lista de precios cargada para este proyecto.');
  else
    with renglones as (
      select nullif(btrim(i->>'product'), '') as producto,
             coalesce((i->>'quantity')::numeric, 0)   as cantidad,
             coalesce((i->>'unit_price')::numeric, 0) as precio,
             nullif(btrim(i->>'presentation'), '')    as envase
        from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i
    ),
    comparado as (
      select r.producto, r.cantidad, r.precio, r.envase,
             (l.fila).producto as producto_lista,
             public.precio_mas_barato(l.fila) as precio_lista,
             round(l.parecido::numeric, 2) as parecido
        from renglones r
        left join lateral (
          select p2 as fila,
                 extensions.similarity(public.normalizar_producto(p2.producto),
                                       public.normalizar_producto(r.producto)) as parecido
            from public.precios_lista p2
           where p2.proyecto = o.proyecto
             and r.producto is not null
           order by extensions.similarity(public.normalizar_producto(p2.producto),
                                          public.normalizar_producto(r.producto)) desc
           limit 1
        ) l on true
       where r.producto is not null and r.cantidad > 0
    ),
    evaluado as (
      select c.*,
             case when c.parecido >= 0.45 and c.precio_lista is not null and c.precio > 0
                  then round((1 - c.precio / c.precio_lista) * 100)
             end as descuento_pct
        from comparado c
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'producto', producto, 'envase', envase, 'cantidad', cantidad, 'precio', precio,
             'producto_lista', case when parecido >= 0.45 then producto_lista end,
             'precio_lista', case when parecido >= 0.45 then precio_lista end,
             'parecido', parecido,
             'descuento_pct', descuento_pct,
             'alerta', coalesce(descuento_pct > v_tolerancia, false),
             'sin_referencia', (parecido is null or parecido < 0.45 or precio_lista is null))
           order by descuento_pct desc nulls last), '[]'::jsonb),
           count(*) filter (where descuento_pct > v_tolerancia)
      into v_precios, v_alertas
      from evaluado;

    v_precios := jsonb_build_object(
      'estado', case when coalesce(v_alertas, 0) > 0 then 'alerta' else 'ok' end,
      'vigencia', v_vigencia,
      'alertas', coalesce(v_alertas, 0),
      'tolerancia', v_tolerancia,
      'tolerancia_propia', v_cli_tol is not null,
      'renglones', v_precios);
  end if;

  return jsonb_build_object(
    'pedido', jsonb_build_object('id', o.id, 'numero', o.order_number, 'proyecto', o.proyecto,
                                 'cliente_nuevo', o.is_new_client, 'estado', o.status,
                                 'company', o.company, 'cuit', o.cuit,
                                 'vendedor', o.seller_code,
                                 'vendedor_nombre', (select s.name from public.sellers s
                                                      where s.code = o.seller_code limit 1)),
    'cuit', v_cuit,
    'primera_vez', v_primera,
    'duplicados_sistema', v_dup,
    'duplicados_web', v_dup_web,
    'duplicados_vivos', coalesce(v_vivos, 0),
    'cliente_de_otro_vendedor', v_otro,
    'pase_femway', v_pase,
    -- Solo la primera vez: después el cliente ya es de FemWay y comprar en los
    -- dos lados es lo normal, no un error.
    'duplicado_grave', (o.proyecto = 'femway' and v_primera
                        and coalesce(v_vivos, 0) > 0 and v_pase is null),
    'precio', v_precios
  );
end;
$function$;

revoke all on function public.admin_controles_pedido(bigint) from public, anon, authenticated;
grant execute on function public.admin_controles_pedido(bigint) to authenticated;
