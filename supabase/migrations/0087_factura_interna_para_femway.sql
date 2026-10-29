-- La factura interna también la ve el admin de FemWay (Andrea): es de FemWay.
-- Antes era solo para el admin que ve todo el panel. Puede cargar costos igual.
-- Se cambia solo el control de acceso de las tres funciones (0083 y 0084).

do $$
declare d text; fn oid;
begin
  foreach fn in array array[
    'public.admin_factura_interna(date)'::regprocedure,
    'public.admin_factura_interna_meses()'::regprocedure,
    'public.admin_guardar_costo_quimwey(text,numeric)'::regprocedure]::oid[]
  loop
    d := pg_get_functiondef(fn);
    if position('or public.admin_proyecto() is not null then' in d) = 0 then
      raise exception 'no encontré el control de acceso en %', fn::regprocedure;
    end if;
    d := replace(d,
      'or public.admin_proyecto() is not null then',
      'or coalesce(public.admin_proyecto(), ''femway'') <> ''femway'' then');
    execute d;
  end loop;
end $$;
