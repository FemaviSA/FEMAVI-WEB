-- Campos de la planilla de pedidos en papel que no existian en la tabla.
-- Los que ya estaban se reusan: company = FACTURAR A/NOMBRE,
-- client_name = A CARGO DE SR., email y phone = los de facturacion,
-- delivery_address = ENTREGAR A/DIRECCION, client_code = N° CLIENTE.
alter table public.orders
  add column if not exists order_number   text,
  add column if not exists account        text,
  add column if not exists sales_cycle    text,
  add column if not exists purchase_order text,
  add column if not exists ship_date      date,
  add column if not exists is_new_client  boolean not null default false,
  -- Facturar a
  add column if not exists bill_address   text,
  add column if not exists bill_city      text,
  add column if not exists tax_condition  text,
  add column if not exists cuit           text,
  add column if not exists payment_terms  text,
  -- Entregar a
  add column if not exists ship_phone     text,
  add column if not exists ship_city      text,
  add column if not exists ship_contact   text,
  add column if not exists carrier        text,
  add column if not exists zone           text,
  -- Suma de cantidad x precio unitario de cada renglon. Puede dar menos que la
  -- suma de lo comprado: un renglon con cantidad negativa es una bonificacion.
  add column if not exists total          numeric(14,2);

comment on column public.orders.order_number is 'PEDIDO N°. Lo asigna el contador, nunca el vendedor.';
comment on column public.orders.account     is 'Cuenta del pedido: C1 o C2. Es la tilde que en la planilla en papel va arriba a la derecha.';
comment on column public.orders.sales_cycle is 'CICLO DE VENTAS. Lo completa administracion.';
comment on column public.orders.carrier     is 'TRANSPORTE con el que se envia.';
comment on column public.orders.total       is 'Suma de los renglones: cantidad x precio unitario.';

alter table public.orders drop constraint if exists orders_account_valida;
alter table public.orders add constraint orders_account_valida
  check (account is null or account in ('C1', 'C2'));

-- La numeracion sigue la del talonario en papel. nextval es atomico: dos
-- pedidos simultaneos nunca reciben el mismo numero.
create sequence if not exists public.order_number_seq start 218000;
grant usage, select on sequence public.order_number_seq to anon, authenticated;

-- Segundo candado: si algo intentara repetir un numero, la base rechaza el
-- pedido en vez de guardar dos con el mismo. Los pedidos viejos de prueba
-- tienen order_number nulo y no molestan: unique permite varios nulos.
create unique index if not exists orders_order_number_unico
  on public.orders (order_number)
  where order_number is not null;

create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists orders_account_idx      on public.orders (account);
