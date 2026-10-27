-- seller_resumen (Mis ventas) todavía filtraba por estados que no existen
-- desde el 01/10/2026. Queda solo 'aprobado', que es lo único que suma: así no
-- hay dudas de que "a confirmar" no le cuenta al vendedor.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.seller_resumen(text,text)'::regprocedure) into d;
  n := replace(d, $a$status in ('aprobado', 'ingresado', 'facturado', 'entregado')$a$,
                  $b$status = 'aprobado'$b$);
  if n = d then raise exception 'seller_resumen: no encontre el filtro de estados'; end if;
  execute n;
end $$;
