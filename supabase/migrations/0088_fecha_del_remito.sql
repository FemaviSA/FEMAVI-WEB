-- La fecha del remito. hist_comprobantes.fecha es la del día en que se cargó
-- el pedido (pos. 18 de HISTPEDI); la del comprobante está en la pos. 99 y es
-- la única que avanza con la numeración. La factura interna tiene que ir por la
-- del remito: un pedido cargado el 30/10 y facturado el 3/11 es de noviembre.
--
-- La sube el sincronizador de la oficina desde su versión del 29/10/2026.
-- Mientras una fila no la tenga, se usa la del pedido.

alter table public.hist_comprobantes add column if not exists fecha_comprobante date;

comment on column public.hist_comprobantes.fecha is 'Fecha de carga del pedido (HISTPEDI pos. 18).';
comment on column public.hist_comprobantes.fecha_comprobante is 'Fecha del remito/factura/NC (HISTPEDI pos. 99).';

-- Se cambian solo los pedazos que tocan la fecha, igual que en la 0087.
do $$
declare d text; fn regprocedure; viejo text; nuevo text;
  cambios text[][] := array[
    -- el sincronizador: la fecha nueva se guarda; si viene vacía (una versión
    -- vieja del sincronizador) no borra la que ya estaba
    array['public.hist_sync_subir(text,text,jsonb)',
          'cliente = excluded.cliente, fecha = excluded.fecha, total = excluded.total;',
          'cliente = excluded.cliente, fecha = excluded.fecha, total = excluded.total,
      fecha_comprobante = coalesce(excluded.fecha_comprobante, hist_comprobantes.fecha_comprobante);'],
    array['public.admin_factura_interna(date)',
          'select c.clave, c.comprobante, c.pedido, c.fecha,',
          'select c.clave, c.comprobante, c.pedido, coalesce(c.fecha_comprobante, c.fecha) as fecha,'],
    array['public.admin_factura_interna(date)',
          'and c.fecha between v_desde and v_hasta',
          'and coalesce(c.fecha_comprobante, c.fecha) between v_desde and v_hasta'],
    array['public.admin_factura_interna_meses()',
          'max(c.fecha)',
          'max(coalesce(c.fecha_comprobante, c.fecha))']];
begin
  for i in 1 .. array_length(cambios, 1) loop
    fn := cambios[i][1]::regprocedure;
    viejo := cambios[i][2];
    nuevo := cambios[i][3];
    d := pg_get_functiondef(fn);
    if position(viejo in d) = 0 then
      raise exception 'no encontré "%" en %', viejo, fn;
    end if;
    execute replace(d, viejo, nuevo);
  end loop;
end $$;
