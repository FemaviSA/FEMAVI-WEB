-- La factura interna también dice cuánto se le facturó a los clientes en el
-- mes: lo realmente facturado según el sistema viejo (remitos y papelitos menos
-- notas de crédito, al precio de venta), por la fecha del remito. No es lo
-- mismo que la solapa Facturación, que suma los pedidos aprobados de la web
-- aunque todavía no hayan salido.
--
-- hist_comprobantes.total es el mismo importe que orders.total (sin IVA).

do $$
declare d text; viejo text; nuevo text;
  cambios text[][] := array[
    array['select c.clave, c.comprobante, c.pedido, coalesce(c.fecha_comprobante, c.fecha) as fecha,',
          'select c.clave, c.comprobante, c.pedido, c.total, coalesce(c.fecha_comprobante, c.fecha) as fecha,'],
    array['''totales'', jsonb_build_object(',
          '''totales'', jsonb_build_object(
      ''facturado'',    coalesce((select sum(signo * total) from comp), 0),
      ''facturado_notas_credito'', coalesce((select sum(signo * total) from comp where clase = ''nota_credito''), 0),']];
begin
  for i in 1 .. array_length(cambios, 1) loop
    viejo := cambios[i][1];
    nuevo := cambios[i][2];
    d := pg_get_functiondef('public.admin_factura_interna(date)'::regprocedure);
    if position(viejo in d) = 0 then
      raise exception 'no encontré "%"', viejo;
    end if;
    execute replace(d, viejo, nuevo);
  end loop;
end $$;
