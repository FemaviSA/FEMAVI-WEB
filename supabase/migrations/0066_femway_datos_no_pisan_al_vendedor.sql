-- El alta automática de un cliente de FemWay que ya existe en el sistema viejo
-- copiaba el registro viejo y descartaba lo que había cargado el vendedor. Con
-- TALOS S.R.L. (03707) eso puso una dirección de hace años: el 05/10/2026 el
-- vendedor escribió la correcta en el pedido 218028 y se perdió; el 16/10 el
-- pedido 218073 se autocompletó con la vieja y se facturó así.
--
-- Ahora manda lo que cargó el vendedor y el sistema viejo completa lo que falte.
-- La razón social y el CUIT siguen saliendo del sistema viejo: son los datos con
-- los que se factura.
--
-- (Aplicada en Supabase con el nombre 0045_femway_datos_no_pisan_al_vendedor;
-- la numeración del repo iba por 0065.)

create or replace function public.femway_cliente_desde_pedido(p_order_id bigint)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
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
    -- ¿Ya existe en el sistema viejo? Entonces lleva su mismo código.
    if v_dig is not null then
      select * into v_h from public.hist_clientes
       where regexp_replace(coalesce(cuit, ''), '\D', '', 'g') = v_dig limit 1;
    end if;

    if v_h.codigo is not null then
      -- Mismo código y misma identidad fiscal que en FEMAVI, pero las
      -- direcciones y los contactos son los que acaba de cargar el vendedor:
      -- él estuvo ahí hoy, el registro viejo puede tener años.
      insert into public.femway_clientes (
        codigo, razon_social, cuit, domicilio, localidad, telefonos, resp_compras,
        entrega_domicilio, entrega_localidad, entrega_telefono, zona,
        vendedor, origen, cliente_femavi, pasado_el
      ) values (
        v_h.codigo, v_h.razon_social,
        nullif(btrim(replace(coalesce(v_h.cuit_formateado, v_h.cuit, ''), '*', '')), ''),
        coalesce(o.bill_address, v_h.domicilio),
        coalesce(o.bill_city, v_h.localidad),
        coalesce(o.phone, o.ship_phone, v_h.telefonos),
        coalesce(o.client_name, v_h.resp_compras),
        coalesce(o.delivery_address, o.bill_address, v_h.entrega_domicilio, v_h.domicilio),
        coalesce(o.ship_city, o.bill_city, v_h.entrega_localidad, v_h.localidad),
        coalesce(o.ship_phone, o.phone, v_h.entrega_telefono),
        coalesce(o.zone, v_h.zona),
        o.seller_code, 'femavi', v_h.codigo, null
      )
      on conflict (codigo) do nothing;
      v_cod := v_h.codigo;
    else
      -- Cliente que nace en FemWay: los datos son los que cargó el vendedor.
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
$function$;

revoke all on function public.femway_cliente_desde_pedido(bigint) from public, anon, authenticated;
