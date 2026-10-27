-- El ABM del cliente de FemWay guarda también su descuento acordado. Sigue la
-- misma regla que el resto: lo que no viene en el payload no se pisa.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.admin_femway_guardar_cliente(jsonb)'::regprocedure) into d;

  -- En el alta
  n := replace(d,
    $a$      entrega_domicilio, entrega_localidad, entrega_telefono, zona,
      vendedor, origen, notas
    ) values ($a$,
    $b$      entrega_domicilio, entrega_localidad, entrega_telefono, zona,
      vendedor, origen, notas, descuento_tolerado
    ) values ($b$);
  n := replace(n,
    $a$      v_vend, 'nuevo',
      nullif(btrim(coalesce(p->>'notas', '')), '')
    );$a$,
    $b$      v_vend, 'nuevo',
      nullif(btrim(coalesce(p->>'notas', '')), ''),
      nullif(btrim(coalesce(p->>'descuento_tolerado', '')), '')::numeric
    );$b$);

  -- En la edición
  n := replace(n,
    $a$      vendedor          = case when p ? 'vendedor'          then v_vend                                                   else f.vendedor end,$a$,
    $b$      vendedor          = case when p ? 'vendedor'          then v_vend                                                   else f.vendedor end,
      descuento_tolerado = case when p ? 'descuento_tolerado' then nullif(btrim(coalesce(p->>'descuento_tolerado', '')), '')::numeric else f.descuento_tolerado end,$b$);

  if position('descuento_tolerado' in n) = 0 then
    raise exception 'admin_femway_guardar_cliente: no encontre donde agregar el descuento';
  end if;
  execute n;
end $$;
