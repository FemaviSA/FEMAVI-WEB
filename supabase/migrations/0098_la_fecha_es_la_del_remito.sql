-- El criterio es la fecha del remito (Santiago, 06/11/2026). Hasta ahora se
-- usaba la del comprobante, que para una factura sin remito propio es la de
-- facturación: el pedido 218127 (INAER) se facturó el 28/10 con el comprobante
-- 024789 pero la mercadería sale con el remito 138742 del 04/11. Es de
-- noviembre.
--
-- Orden: si el pedido tiene un remito emitido y todavía sin facturar, manda su
-- fecha; si no, la del comprobante; si no, la de carga del pedido.
--
-- Además se devuelve la lista de remitos del mes que siguen sin facturar: con
-- uno de esos abierto, el mes no está cerrado.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.admin_factura_interna(date)'::regprocedure);

  n := replace(d,
    'select c.clave, c.comprobante, c.pedido, c.total, coalesce(c.fecha_comprobante, c.fecha) as fecha,',
    'select c.clave, c.comprobante, c.pedido, c.total,
           coalesce(rp.fecha, c.fecha_comprobante, c.fecha) as fecha,');
  if n = d then raise exception 'no encontré el select de comp'; end if;

  n := replace(n,
    '      left join public.hist_clientes h on h.codigo = c.cliente
     where c.tipo in (''9'',''7'',''3'')',
    '      left join public.hist_clientes h on h.codigo = c.cliente
      -- El remito de ese pedido, si todavía no se facturó: su fecha manda.
      left join public.hist_remitos_pendientes rp on rp.pedido = c.pedido
     where c.tipo in (''9'',''7'',''3'')');

  n := replace(n,
    '       and coalesce(c.fecha_comprobante, c.fecha) between v_desde and v_hasta',
    '       and coalesce(rp.fecha, c.fecha_comprobante, c.fecha) between v_desde and v_hasta');

  n := replace(n,
    '            or (coalesce(c.fecha_comprobante, c.fecha) >= date ''2026-09-01''',
    '            or (coalesce(rp.fecha, c.fecha_comprobante, c.fecha) >= date ''2026-09-01''');

  n := replace(n,
    '    ''ultimo_comprobante'', (select max(fecha) from comp),',
    '    ''ultimo_comprobante'', (select max(fecha) from comp),
    ''sin_facturar'', (select coalesce(jsonb_agg(jsonb_build_object(
                        ''comprobante'', rp.comprobante, ''fecha'', rp.fecha, ''pedido'', rp.pedido,
                        ''vendedor'', ltrim(rp.vendedor, ''0''),
                        ''cliente'', coalesce(h2.razon_social, o2.company))
                        order by rp.fecha), ''[]''::jsonb)
                       from public.hist_remitos_pendientes rp
                       left join public.hist_clientes h2 on h2.codigo = rp.cliente
                       left join public.orders o2 on o2.order_number = rp.pedido::text and o2.proyecto = ''femway''
                      where rp.fecha between v_desde and v_hasta
                        and (o2.id is not null
                             or exists (select 1 from public.sellers s2
                                         where s2.proyecto = ''femway''
                                           and lpad(s2.code, 3, ''0'') = lpad(coalesce(rp.vendedor, ''''), 3, ''0'')))),');

  if position('sin_facturar' in n) = 0 then raise exception 'no pude agregar sin_facturar'; end if;
  if position('rp.fecha, c.fecha_comprobante' in n) = 0 then raise exception 'no quedó la fecha del remito'; end if;
  execute n;
end $$;
