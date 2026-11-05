-- El criterio por código de vendedor necesita piso: la factura de octubre se
-- lleva todo lo anterior (v_desde = 2000) y los códigos del sistema viejo se
-- reciclan — el 055 de 2015 era otro vendedor de FEMAVI. Sin piso, la factura
-- de octubre pasó de 56 a 135 comprobantes y se trajo 1.815 kg de L-30-OIL a
-- granel que no tienen nada que ver con FemWay.
--
-- FemWay arrancó el 24/09/2026. Antes de septiembre de 2026, un código de
-- vendedor no dice nada; el número de pedido de la web sí, siempre.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.admin_factura_interna(date)'::regprocedure);
  n := replace(d,
    $a$            or exists (select 1 from public.sellers s
                        where s.proyecto = 'femway'
                          and lpad(s.code, 3, '0') = lpad(coalesce(c.vendedor, ''), 3, '0')))$a$,
    $b$            or (coalesce(c.fecha_comprobante, c.fecha) >= date '2026-09-01'
                and exists (select 1 from public.sellers s
                             where s.proyecto = 'femway'
                               and lpad(s.code, 3, '0') = lpad(coalesce(c.vendedor, ''), 3, '0'))))$b$);
  if n = d then raise exception 'admin_factura_interna: no encontré el criterio por vendedor'; end if;
  execute n;
end $$;
