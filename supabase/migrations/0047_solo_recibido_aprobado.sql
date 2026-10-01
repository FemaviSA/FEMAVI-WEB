-- Los pedidos tienen tres estados y nada más: recibido, aprobado y rechazado.
-- Ingresado, facturado y entregado no se usan (Santiago, 01/10/2026). Los que
-- estaban así pasan a aprobado, que es lo que eran para la estadística. El
-- cambio queda en order_status_log, así que se puede ver cómo estaban:
-- 218002 entregado, 218003 y 218004 ingresado.

update public.orders set status = 'aprobado'
 where status in ('ingresado', 'facturado', 'entregado');

alter table public.orders drop constraint orders_status_valido;
alter table public.orders add constraint orders_status_valido
  check (status in ('recibido', 'aprobado', 'rechazado'));

-- El vendedor ve un pedido recién cuando está aprobado: en sus fichas no
-- aparecen los que esperan aprobación. El admin los sigue viendo.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.femway_ficha_base(text)'::regprocedure) into d;
  n := replace(d, 'femway_ficha_base(p_codigo text)',
                  'femway_ficha_base(p_codigo text, p_solo_aprobados boolean DEFAULT false)');
  n := replace(n, $a$and o.status <> 'rechazado'$a$,
                  $b$and o.status <> 'rechazado'
       and (not p_solo_aprobados or o.status = 'aprobado')$b$);
  if position('p_solo_aprobados or' in n) = 0 then raise exception 'femway_ficha_base: no encontre el texto'; end if;
  drop function public.femway_ficha_base(text);
  execute n;
end $$;
revoke all on function public.femway_ficha_base(text, boolean) from public, anon, authenticated;

do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.seller_femway_ficha_cliente(text,text)'::regprocedure) into d;
  n := replace(d, 'return public.femway_ficha_base(v_cod);', 'return public.femway_ficha_base(v_cod, true);');
  if n = d then raise exception 'seller_femway_ficha_cliente: no encontre el texto'; end if;
  execute n;
end $$;

-- La ficha de FEMAVI traía también los pedidos de FemWay del mismo código, y
-- los rechazados. Solo FEMAVI, y sin rechazados, igual que la de FemWay.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.hist_ficha_base(text)'::regprocedure) into d;
  n := replace(d, $a$and ltrim(v_cod, '0') <> '')$a$,
                  $b$and ltrim(v_cod, '0') <> ''
                       and o.proyecto = 'femavi'
                       and o.status <> 'rechazado')$b$);
  if n = d then raise exception 'hist_ficha_base: no encontre el texto'; end if;
  execute n;
end $$;

do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.seller_ficha_cliente(text,text)'::regprocedure) into d;
  n := replace(d, $a$where p->>'vendedor' = v_code)$a$,
                  $b$where p->>'vendedor' = v_code and p->>'estado' = 'aprobado')$b$);
  if n = d then raise exception 'seller_ficha_cliente: no encontre el texto'; end if;
  execute n;
end $$;
