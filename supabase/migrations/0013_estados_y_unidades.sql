-- ── Unidad de venta de cada producto ──
-- El pedido guarda "400" pero no si son litros o kilos. El catálogo sí lo
-- sabe por sus presentaciones.
alter table public.products add column if not exists unit text;
update public.products set unit = case
    when exists (select 1 from unnest(presentations) x where x ~* '(kg|kilos?)') then 'kg'
    when exists (select 1 from unnest(presentations) x
                  where x ~* '\m(l|lt|lts|litros?)\M' or x ~* '[0-9] *l\M') then 'L'
    else 'u'
  end
 where unit is null;
alter table public.products drop constraint if exists products_unit_valida;
alter table public.products add constraint products_unit_valida check (unit is null or unit in ('L', 'kg', 'u'));
comment on column public.products.unit is 'Unidad de venta: L (litros), kg (kilos) o u (unidades, p. ej. cajas).';

-- ── Estados del pedido ──
-- recibido -> aprobado -> ingresado -> facturado -> entregado, o rechazado.
-- Reemplaza la regla vieja (pending/processing/completed/cancelled), que nunca se usó.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders drop constraint if exists orders_status_valido;
update public.orders set status = 'recibido' where status is null or status <> all (array['recibido','aprobado','ingresado','facturado','entregado','rechazado']);
alter table public.orders alter column status set default 'recibido';
alter table public.orders add constraint orders_status_valido
  check (status in ('recibido', 'aprobado', 'ingresado', 'facturado', 'entregado', 'rechazado'));
alter table public.orders add column if not exists rejection_reason  text;
alter table public.orders add column if not exists status_changed_at timestamptz;
create index if not exists orders_status_idx on public.orders (status);

-- ── Historial: quién movió cada pedido y cuándo ──
create table if not exists public.order_status_log (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references public.orders(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  text,
  note        text,
  changed_at  timestamptz not null default now()
);
create index if not exists order_status_log_order_idx on public.order_status_log (order_id, changed_at);
alter table public.order_status_log enable row level security;
revoke all on public.order_status_log from anon, authenticated;
grant select on public.order_status_log to authenticated;
drop policy if exists order_status_log_admin_read on public.order_status_log;
create policy order_status_log_admin_read on public.order_status_log
  for select using (public.is_admin());

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_log (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status,
            case when new.seller_code is not null then 'vendedor ' || new.seller_code else 'web' end);
    return new;
  end if;

  if new.status is distinct from old.status then
    -- Rechazar sin motivo deja al vendedor sin saber qué corregir.
    if new.status = 'rechazado' and nullif(btrim(coalesce(new.rejection_reason, '')), '') is null then
      raise exception 'Para rechazar un pedido hay que indicar el motivo.';
    end if;
    new.status_changed_at := now();
    insert into public.order_status_log (order_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.jwt() ->> 'email',
            case when new.status = 'rechazado' then new.rejection_reason end);
  end if;
  return new;
end;
$fn$;
revoke all on function public.log_order_status() from public, anon, authenticated;

drop trigger if exists orders_status_log_upd on public.orders;
create trigger orders_status_log_upd before update of status on public.orders
  for each row execute function public.log_order_status();
drop trigger if exists orders_status_log_ins on public.orders;
create trigger orders_status_log_ins after insert on public.orders
  for each row execute function public.log_order_status();
