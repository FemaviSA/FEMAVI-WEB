-- El vendedor ve lo suyo del mes (o ciclo) actual y del anterior, nada más.
-- Últimos 3 y el año quedan para el gerente (Santiago, 01/10/2026).
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.seller_resumen(text,text)'::regprocedure) into d;
  n := replace(d, $a$  -- Qué meses entran, para los dos proyectos por igual.$a$,
    $b$  if p_periodo in ('ultimos3', 'anio') and not v_seller.es_gerente then
    raise exception 'periodo_no_permitido' using errcode = 'P0001';
  end if;

  -- Qué meses entran, para los dos proyectos por igual.$b$);
  if n = d then raise exception 'seller_resumen: no encontre el texto'; end if;
  execute n;
end $$;
