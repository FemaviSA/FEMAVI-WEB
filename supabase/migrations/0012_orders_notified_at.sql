-- Marca cuándo salió el mail del pedido. La función de aviso lo reclama de forma
-- atómica y solo si está vacío: así nadie puede usarla para reenviar pedidos y
-- llenar de correo a ventas@.
alter table public.orders add column if not exists notified_at timestamptz;
comment on column public.orders.notified_at is 'Cuándo se mandó el mail del pedido. Se manda una sola vez.';
