-- En la factura interna el cliente salía del pedido web, donde el vendedor
-- escribe el nombre de fantasía: el remito 138520 figuraba como "Petete
-- inyección" cuando el cliente es PIETRONAVE CARLOS (20590). El comprobante lo
-- emite el sistema viejo, así que el nombre que vale es el de ahí; el del
-- pedido web queda de respaldo para cuando el cliente todavía no esté cargado.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.admin_factura_interna(date)'::regprocedure);
  n := replace(d,
    'coalesce(o.company, h.razon_social) as cliente',
    'coalesce(h.razon_social, o.company) as cliente');
  if n = d then raise exception 'admin_factura_interna: no encontré el nombre del cliente'; end if;
  execute n;
end $$;
