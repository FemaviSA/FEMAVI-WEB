-- En la rentabilidad, "sin artículo" también incluye los productos que se
-- reconocen en el sistema viejo pero no están en la lista de Quimwey (DIEL FEM A,
-- MULTICORTE a granel): no tienen costo y hay que asignarles el de la lista.
do $$
declare d text; viejo text := 'select coalesce(jsonb_agg(distinct nombre), ''[]''::jsonb)
                       from con_art where articulo is null)';
  nuevo text := 'select coalesce(jsonb_agg(distinct c.nombre), ''[]''::jsonb)
                       from con_art c left join public.costos_quimwey k on k.articulo = c.articulo
                      where k.articulo is null)';
begin
  d := pg_get_functiondef('public.admin_rentabilidad(date,text)'::regprocedure);
  if position(viejo in d) = 0 then raise exception 'no encontré sin_articulo'; end if;
  execute replace(d, viejo, nuevo);
end $$;
