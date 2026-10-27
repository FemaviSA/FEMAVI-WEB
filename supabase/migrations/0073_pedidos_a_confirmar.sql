-- Un pedido puede estar bien cargado y aun así no estar cerrado: el vendedor lo
-- pasó pero hay que hablar con el cliente para confirmarlo. Hasta ahora la
-- única salida era aprobarlo, y aprobarlo ya le suma a la facturación del
-- vendedor. Por eso se agrega un estado en el medio:
--
--   recibido  ->  a confirmar  ->  aprobado
--
-- "A confirmar" no suma en Mis ventas (igual que recibido: el resumen del
-- vendedor cuenta solo los aprobados) y tampoco exige el ciclo, que se elige
-- recién al aprobar. Es una cola de trabajo de administración: se imprime, se
-- llama al cliente y, si confirma, se aprueba.

alter table public.orders drop constraint orders_status_valido;
alter table public.orders add constraint orders_status_valido
  check (status in ('recibido', 'a_confirmar', 'aprobado', 'rechazado'));

-- Cuándo salió el último mail con la planilla para imprimir. A diferencia de
-- los otros dos, este mail se puede volver a pedir (el papel se pierde), así
-- que la marca no es de un solo uso: solo frena los reenvíos seguidos.
alter table public.orders add column if not exists confirmar_notificado_at timestamptz;

create index if not exists orders_status_idx on public.orders (status);
