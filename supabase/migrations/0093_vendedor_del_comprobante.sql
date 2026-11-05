-- El comprobante del sistema viejo trae el código de vendedor (HISTPEDI pos.
-- 140), y nunca lo sincronizábamos. Es lo único que reconoce una venta de
-- FemWay cuando el remito no quedó atado al número de pedido de la web: pasó
-- en septiembre con INDUBOM (remito 138402) y TALLERES AUTOMUNDO (138457),
-- $2.360.000 que no entraron ni en la estadística ni en la factura interna.

alter table public.hist_comprobantes add column if not exists vendedor text;
comment on column public.hist_comprobantes.vendedor is
  'Código de vendedor del sistema viejo (HISTPEDI pos. 140), con ceros: "055".';

create index if not exists hist_comprobantes_vendedor_idx on public.hist_comprobantes (vendedor);

-- El sincronizador lo sube junto con el resto. Si viene vacío (una versión
-- vieja del sincronizador) no borra el que ya estaba, igual que fecha_comprobante.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.hist_sync_subir(text,text,jsonb)'::regprocedure);
  if position('fecha_comprobante = coalesce(excluded.fecha_comprobante, hist_comprobantes.fecha_comprobante);' in d) = 0 then
    raise exception 'hist_sync_subir: no encontré el upsert de comprobantes';
  end if;
  d := replace(d,
    'fecha_comprobante = coalesce(excluded.fecha_comprobante, hist_comprobantes.fecha_comprobante);',
    'fecha_comprobante = coalesce(excluded.fecha_comprobante, hist_comprobantes.fecha_comprobante),
      vendedor = coalesce(excluded.vendedor, hist_comprobantes.vendedor);');

  -- Carga del campo solo, por clave: para rellenar lo que ya estaba subido sin
  -- tocar ningún otro dato del comprobante.
  if position($x$  elsif p_tabla = 'renglones' then$x$ in d) = 0 then
    raise exception 'hist_sync_subir: no encontré la rama de renglones';
  end if;
  d := replace(d,
    $x$  elsif p_tabla = 'renglones' then$x$,
    $x$  elsif p_tabla = 'comprobantes_vendedor' then
    update public.hist_comprobantes c
       set vendedor = f.vendedor
      from jsonb_to_recordset(p_filas) as f(clave text, vendedor text)
     where c.clave = f.clave and f.vendedor is not null;
  elsif p_tabla = 'renglones' then$x$);
  execute d;
end $$;
