-- Los pedidos "a confirmar" los veía solo administración, desde el panel.
-- Mariano Vega (vendedor 57, gerente de FemWay) no tiene usuario de admin, así
-- que los ve desde su propio usuario de vendedor: todos los del equipo de su
-- proyecto, solo para mirar. Aprobar sigue siendo de Andrea y de Santiago.
--
-- Trae las notas y la fecha de entrega a propósito: son el "llamar el 23/10"
-- que el vendedor escribió, que es justo lo que el gerente necesita seguir.

create or replace function public.seller_pedidos_a_confirmar(p_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_seller public.sellers%rowtype;
  v_res    jsonb;
begin
  select v.* into v_seller
    from public.seller_sessions s
    join public.sellers v on v.code = s.seller_code and v.active
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now();
  if not found then
    raise exception 'sesion_vencida' using errcode = 'P0001';
  end if;
  if not v_seller.es_gerente then
    raise exception 'no_es_gerente' using errcode = 'P0001';
  end if;

  -- Las horas de la base son UTC: se pasan a hora argentina antes de sacar el
  -- día, si no un pedido de las 22 aparece como del día siguiente.
  select coalesce(jsonb_agg(jsonb_build_object(
           'numero', o.order_number,
           'fecha',  (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date,
           'dias',   current_date - (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date,
           'vendedor', coalesce(v.name, o.seller_code),
           'vendedor_code', o.seller_code,
           'comparte_con', (select v2.name from public.sellers v2 where v2.code = o.compartido_con),
           'cliente', o.company,
           'codigo', nullif(btrim(coalesce(o.client_code, '')), ''),
           'cuenta', o.account,
           'total', o.total,
           'entrega', nullif(btrim(coalesce(o.ship_date, '')), ''),
           'notas', nullif(btrim(coalesce(o.notes, '')), ''),
           'items', coalesce(o.items, '[]'::jsonb)
         ) order by o.created_at), '[]'::jsonb)
    into v_res
    from public.orders o
    left join public.sellers v on v.code = o.seller_code
   where o.status = 'a_confirmar'
     and o.proyecto = v_seller.proyecto;

  return v_res;
end;
$function$;

revoke all on function public.seller_pedidos_a_confirmar(text) from public;
grant execute on function public.seller_pedidos_a_confirmar(text) to anon, authenticated, service_role;
