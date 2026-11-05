-- La factura interna reconocía una venta de FemWay solo por el número de
-- pedido: el remito tenía que decir 218xxx. Si ventas@ lo cargaba con la
-- numeración vieja, la venta no existía para FemWay. Pasó en septiembre con
-- INDUBOM (138402) y TALLERES AUTOMUNDO (138457): $2.360.000 de venta y
-- $710.200 de costo que no se le facturaron a FemWay.
--
-- Ahora vale cualquiera de los dos: el pedido de la web, o el código de
-- vendedor del comprobante (14, 55, 56, 57, 61, 62 y 93 son de FemWay; los
-- códigos no se repiten entre proyectos). Así no se pierde ninguna por un
-- número mal cargado, y si mañana se suma un vendedor alcanza con darlo de
-- alta en FemWay.
--
-- 0095 le pone el piso de fecha, que hace falta.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.admin_factura_interna(date)'::regprocedure);

  -- El cliente y el vendedor ya no dependen de que exista el pedido web.
  n := replace(d,
    $a$           o.company as cliente, o.seller_code
      from public.hist_comprobantes c
      join public.orders o on o.order_number = c.pedido::text and o.proyecto = 'femway'
     where c.tipo in ('9','7','3')$a$,
    $b$           coalesce(o.company, h.razon_social) as cliente,
           coalesce(o.seller_code, ltrim(c.vendedor, '0')) as seller_code
      from public.hist_comprobantes c
      left join public.orders o on o.order_number = c.pedido::text and o.proyecto = 'femway'
      left join public.hist_clientes h on h.codigo = c.cliente
     where c.tipo in ('9','7','3')
       -- De FemWay por el pedido de la web, o por el código de vendedor.
       and (o.id is not null
            or exists (select 1 from public.sellers s
                        where s.proyecto = 'femway'
                          and lpad(s.code, 3, '0') = lpad(coalesce(c.vendedor, ''), 3, '0')))$b$);

  if n = d then raise exception 'admin_factura_interna: no encontré el comp'; end if;
  execute n;
end $$;
