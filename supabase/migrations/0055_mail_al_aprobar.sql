-- Los mails del pedido cambian (Santiago, 01/10/2026):
--   * al cargarse: FemWay a andrea@ y santiago@; FEMAVI solo a santiago@.
--     Lo revisan y lo aprueban.
--   * al aprobarse: a ventas@, con la planilla en Excel, para imprimir y
--     cargar en el sistema viejo. ventas@ ya no recibe los pedidos al cargarse.
-- Esta marca es la del mail de aprobado: como notified_at con el de ingreso,
-- se reclama de forma atómica y se manda una sola vez por pedido.

alter table public.orders add column if not exists aprobado_notificado_at timestamptz;
