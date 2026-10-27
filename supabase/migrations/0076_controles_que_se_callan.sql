-- Los tres avisos del pedido estaban bien la primera vez y eran ruido a partir
-- de la segunda (Santiago, 27/10/2026, mirando los pedidos de SPOSITO JONATAN
-- JAVIER, que es distribuidor de FemWay y ya lleva 11 pedidos):
--
--  1. "Ya es cliente de FEMAVI": todos los clientes de FemWay están también en
--     la base de FEMAVI, así que el aviso sirve la primera vez —para decidir si
--     el cliente pasa a FemWay— y después no dice nada nuevo.
--  2. "Ya hay otro pedido web de este mismo cliente": el que compra seguido
--     siempre lo dispara. Lo que hay que cazar es el pedido cargado dos veces,
--     no al cliente fiel: ahora solo avisa si hay otro por el MISMO importe en
--     los últimos 30 días.
--  3. El precio: un distribuidor trabaja con su descuento y no es una alerta.
--     Cada cliente de FemWay puede tener el suyo; si no tiene, vale el 20%.

alter table public.femway_clientes
  add column if not exists descuento_tolerado numeric;

comment on column public.femway_clientes.descuento_tolerado is
  'Descuento sobre la lista que este cliente tiene acordado (%). Vacío = el 20% general. Es solo para no alertar de más al aprobar.';

-- Sposito es distribuidor: trabaja con 25% sobre la lista.
update public.femway_clientes set descuento_tolerado = 25, updated_at = now()
 where codigo = '20589';
