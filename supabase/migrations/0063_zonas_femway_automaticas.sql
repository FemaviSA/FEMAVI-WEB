-- Zonas de FemWay, segunda parte: que se completen solas y pasar lo ya
-- cargado a los códigos nuevos. La tabla y la función están en 0062.

-- ── Que se complete sola ──
-- Solo cuando cambia la localidad (o al crear): si después alguien corrige la
-- zona a mano sin tocar la localidad, se respeta.

create or replace function public.femway_zona_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v text;
begin
  if new.proyecto is distinct from 'femway' then return new; end if;
  if tg_op = 'INSERT' or new.ship_city is distinct from old.ship_city then
    v := public.femway_zona_de(new.ship_city);
    if v is not null then
      new.zone := v;
    elsif new.zone is not null and not exists (select 1 from public.femway_zonas where codigo = btrim(new.zone)) then
      new.zone := null;
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function public.femway_zona_pedido() from public, anon, authenticated;

drop trigger if exists femway_zona_pedido on public.orders;
create trigger femway_zona_pedido
  before insert or update of ship_city on public.orders
  for each row execute function public.femway_zona_pedido();

create or replace function public.femway_zona_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v text;
begin
  if tg_op = 'INSERT'
     or coalesce(new.entrega_localidad, new.localidad) is distinct from coalesce(old.entrega_localidad, old.localidad) then
    v := public.femway_zona_de(coalesce(new.entrega_localidad, new.localidad));
    if v is not null then
      new.zona := v;
    elsif new.zona is not null and not exists (select 1 from public.femway_zonas where codigo = btrim(new.zona)) then
      new.zona := null;
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function public.femway_zona_cliente() from public, anon, authenticated;

drop trigger if exists femway_zona_cliente on public.femway_clientes;
create trigger femway_zona_cliente
  before insert or update of entrega_localidad, localidad on public.femway_clientes
  for each row execute function public.femway_zona_cliente();

-- ── Lo que ya está cargado ──
-- Se pisan todos los códigos viejos: lo que no se reconoce queda vacío.

update public.femway_clientes
   set zona = public.femway_zona_de(coalesce(entrega_localidad, localidad));

update public.orders
   set zone = public.femway_zona_de(ship_city)
 where proyecto = 'femway';
