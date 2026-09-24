-- Dos cosas que cambian por los clientes de FemWay (ver 0035):
--
-- 1. El autocompletado de la planilla. Es la misma llamada para todos: la base
--    decide según el proyecto del código con el que el vendedor inició sesión.
--    El de FemWay busca en sus clientes de FemWay; el de FEMAVI, en los suyos
--    del sistema viejo.
--
-- 2. El control de duplicados deja de ser alarma cuando el cliente está
--    registrado como un pase de FEMAVI a FemWay: que esté en los dos lados es
--    a propósito. Se sigue mostrando, pero en verde y sin "ojo".
--
-- De paso se arregla el control de precio, que se caía en el primer pedido de
-- FemWay que lo usara: el subselect lateral devolvía la fila de la lista más la
-- columna "parecido", y precio_mas_barato() espera exactamente una fila de
-- precios_lista. Nunca se había disparado porque no había lista de precios
-- cargada para FEMAVI y no existía todavía ningún pedido de FemWay.

create or replace function public.seller_datos_cliente(p_token text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  CODIGOS_HABILITADOS constant text[] := array['10'];
  v_code    text := public.seller_de_token(p_token);
  v_proy    text;
  v_digitos text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
  v_fila    public.hist_clientes%rowtype;
  v_fw      public.femway_clientes%rowtype;
begin
  if v_digitos = '' then return null; end if;
  select proyecto into v_proy from public.sellers where code = v_code;

  if v_proy = 'femway' then
    select * into v_fw from public.femway_clientes
     where codigo = lpad(v_digitos, 5, '0') and vendedor = v_code;
    if not found then return null; end if;
    return jsonb_build_object(
      'codigo',            v_fw.codigo,
      'company',           v_fw.razon_social,
      'cuit',              v_fw.cuit,
      'bill_address',      v_fw.domicilio,
      'bill_city',         v_fw.localidad,
      'phone',             v_fw.telefonos,
      'client_name',       v_fw.resp_compras,
      'delivery_address',  coalesce(v_fw.entrega_domicilio, v_fw.domicilio),
      'ship_city',         coalesce(v_fw.entrega_localidad, v_fw.localidad),
      'ship_phone',        v_fw.entrega_telefono,
      'zone',              v_fw.zona,
      'nota',              v_fw.notas
    );
  end if;

  if not (v_code = any (CODIGOS_HABILITADOS)) then return null; end if;

  select * into v_fila
    from public.hist_clientes
   where codigo = lpad(v_digitos, 5, '0')
     and vendedor = lpad(v_code, 3, '0');
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
    'nota',              nullif(btrim(coalesce(v_fila.otros, '')), '')
  );
end;
$fn$;
revoke all on function public.seller_datos_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_datos_cliente(text, text) to anon, authenticated;

create or replace function public.seller_buscar_cliente(p_token text, p_q text)
returns table (codigo text, razon_social text, localidad text, cuit text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  CODIGOS_HABILITADOS constant text[] := array['10'];
  v_code    text := public.seller_de_token(p_token);
  v_proy    text;
  q         text := nullif(btrim(coalesce(p_q, '')), '');
  q_digitos text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if q is null or length(q) < 3 then return; end if;
  select proyecto into v_proy from public.sellers where code = v_code;

  if v_proy = 'femway' then
    return query
    select c.codigo, c.razon_social, c.localidad, c.cuit
      from public.femway_clientes c
     where c.vendedor = v_code
       and (c.razon_social ilike '%' || q || '%'
            or (q_digitos is not null and c.cuit like '%' || q_digitos || '%'))
     order by c.razon_social
     limit 8;
    return;
  end if;

  if not (v_code = any (CODIGOS_HABILITADOS)) then return; end if;

  return query
  select c.codigo, c.razon_social, c.localidad, c.cuit
    from public.hist_clientes c
    left join public.hist_resumen_cliente r on r.codigo = c.codigo
   where c.vendedor = lpad(v_code, 3, '0')
     and (c.razon_social ilike '%' || q || '%'
          or (q_digitos is not null and c.cuit like '%' || q_digitos || '%'))
   order by r.ultima_compra desc nulls last, c.razon_social
   limit 8;
end;
$fn$;
revoke all on function public.seller_buscar_cliente(text, text) from public, anon, authenticated;
grant execute on function public.seller_buscar_cliente(text, text) to anon, authenticated;

create or replace function public.admin_controles_pedido(p_order_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  o public.orders%rowtype;
  v_cuit jsonb;
  v_dig text;
  v_nombre text;
  v_dup jsonb;
  v_dup_web jsonb;
  v_vivos int;
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

  select coalesce(jsonb_agg(x order by x.coincide_por, x.parecido desc), '[]'::jsonb),
         count(*) filter (where x.compro_ultimo_anio)
    into v_dup, v_vivos
    from (
      select c.codigo, c.razon_social, c.cuit, c.localidad, c.vendedor, r.ultima_compra,
             (r.ultima_compra > current_date - 365) as compro_ultimo_anio,
             case when v_dig is not null and c.cuit = v_dig then 'cuit' else 'nombre' end as coincide_por,
             round(extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre)::numeric, 2) as parecido
        from public.hist_clientes c
        left join public.hist_resumen_cliente r on r.codigo = c.codigo
       where (v_dig is not null and c.cuit = v_dig)
          or (v_nombre is not null and length(v_nombre) >= 4
              and public.normalizar_razon(c.razon_social) % v_nombre
              and extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre) >= 0.55)
       order by case when v_dig is not null and c.cuit = v_dig then 0 else 1 end,
                extensions.similarity(public.normalizar_razon(c.razon_social), v_nombre) desc
       limit 5
    ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'numero', p.order_number, 'fecha', p.created_at, 'proyecto', p.proyecto,
           'company', p.company, 'cuit', p.cuit, 'vendedor', p.seller_code, 'estado', p.status)
         order by p.created_at desc), '[]'::jsonb) into v_dup_web
    from (
      select * from public.orders p
       where p.id <> o.id
         and p.status <> 'rechazado'
         and ((v_dig is not null and regexp_replace(coalesce(p.cuit, ''), '\D', '', 'g') = v_dig)
              or (v_nombre is not null and length(v_nombre) >= 4
                  and public.normalizar_razon(p.company) = v_nombre))
       order by p.created_at desc
       limit 5
    ) p;

  -- ¿Ya está registrado como un pase de FEMAVI a FemWay? Entonces aparecer en
  -- los dos lados es a propósito: se muestra, pero no alarma.
  v_cod_pedido := nullif(regexp_replace(coalesce(o.client_code, ''), '\D', '', 'g'), '');
  if o.proyecto = 'femway' then
    select jsonb_build_object('codigo', f.codigo, 'razon_social', f.razon_social,
                              'vendedor', f.vendedor, 'pasado_el', f.pasado_el)
      into v_pase
      from public.femway_clientes f
     where f.origen = 'femavi'
       and ((v_cod_pedido is not null and f.codigo = lpad(v_cod_pedido, 5, '0'))
            or (v_dig is not null and regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g') = v_dig))
     limit 1;
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
      -- La fila de la lista viaja entera como un solo valor: precio_mas_barato()
      -- espera exactamente una fila de precios_lista, y si le sumamos la columna
      -- "parecido" se cae con "input has too many columns".
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
       where r.producto is not null and r.cantidad > 0   -- las bonificaciones no se controlan
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
             'alerta', coalesce(descuento_pct > 20, false),
             'sin_referencia', (parecido is null or parecido < 0.45 or precio_lista is null))
           order by descuento_pct desc nulls last), '[]'::jsonb),
           count(*) filter (where descuento_pct > 20)
      into v_precios, v_alertas
      from evaluado;

    v_precios := jsonb_build_object(
      'estado', case when coalesce(v_alertas, 0) > 0 then 'alerta' else 'ok' end,
      'vigencia', v_vigencia,
      'alertas', coalesce(v_alertas, 0),
      'renglones', v_precios);
  end if;

  return jsonb_build_object(
    'pedido', jsonb_build_object('id', o.id, 'numero', o.order_number, 'proyecto', o.proyecto,
                                 'cliente_nuevo', o.is_new_client, 'estado', o.status,
                                 'company', o.company, 'cuit', o.cuit),
    'cuit', v_cuit,
    'duplicados_sistema', v_dup,
    'duplicados_web', v_dup_web,
    'duplicados_vivos', coalesce(v_vivos, 0),
    'pase_femway', v_pase,
    'duplicado_grave', (o.proyecto = 'femway' and coalesce(v_vivos, 0) > 0 and v_pase is null),
    'precio', v_precios
  );
end;
$fn$;
