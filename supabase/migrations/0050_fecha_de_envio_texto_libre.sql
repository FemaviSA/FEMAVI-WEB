-- La fecha de envío es texto libre: los vendedores ponen "N" (normal), "URG"
-- (urgente) o una fecha si el pedido es diferido. Lo que escriban, va.
-- Santiago, 01/10/2026. Las fechas que ya estaban quedan como dd/mm/aaaa.

alter table public.orders
  alter column ship_date type text
  using to_char(ship_date, 'DD/MM/YYYY');

do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.pedido_insertar(jsonb,text,text)'::regprocedure) into d;
  n := replace(d, $a$nullif(btrim(p->>'ship_date'), '')::date,$a$,
                  $b$left(nullif(btrim(p->>'ship_date'), ''), 60),$b$);
  if n = d then raise exception 'pedido_insertar: no encontre el texto'; end if;
  execute n;
end $$;
