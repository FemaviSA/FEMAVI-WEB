-- La condición de pago se elige de una lista y es obligatoria: los vendedores
-- escribían cualquier cosa ("15 días FF", "15 DIAS", "15 días fecha
-- factura"...). Santiago, 06/10/2026. Vale para los pedidos nuevos; los que ya
-- estaban quedan como están, y al editarlos desde el admin se puede dejar la
-- condición vieja (admin_editar_pedido no cambia).
-- La misma lista está en src/lib/orders.ts (CONDICIONES_PAGO).

do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.pedido_insertar(jsonb,text,text)'::regprocedure) into d;
  n := replace(d, $a$  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then$a$,
    $b$  if coalesce(btrim(p->>'payment_terms'), '') not in (
       'Contado (efectivo/transferencia)', 'Contado (cheque/echeq)',
       'Pago 7 días', 'Pago 15 días', 'Pago 30 días', 'Pago anticipado') then
    raise exception 'condicion_pago_invalida' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then$b$);
  if n = d then raise exception 'pedido_insertar: no encontre el texto'; end if;
  execute n;
end $$;
