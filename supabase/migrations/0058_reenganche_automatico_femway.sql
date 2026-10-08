-- El cliente nuevo de FemWay se reengancha solo cuando aparece en el sistema viejo.
--
-- El alta automática (0038) busca el CUIT en el sistema viejo una sola vez, al
-- entrar el pedido. Si el cliente es nuevo todavía no está ahí y nace con un
-- número de la serie 50001. Después administración lo carga en el sistema viejo
-- para facturar, la sincronización lo trae con su código de verdad (205xx)… y
-- había que entrar a Clientes a traerlo a mano y corregir los pedidos. Al
-- 08/10/2026 había 14 esperando.
--
-- Ahora, cada vez que la sincronización escribe un cliente en hist_clientes, si
-- su CUIT coincide con un cliente de la serie propia de FemWay —con el de su
-- ficha o con el de alguno de sus pedidos, porque a veces el CUIT se corrige en
-- el pedido y la ficha queda con el de la planilla—:
--   · el cliente de FemWay pasa a tener el código del sistema viejo, con esos
--     datos, el mismo vendedor y sus notas;
--   · sus pedidos se mueven al código nuevo, sin ceros adelante;
--   · queda como pase confirmado: el CUIT coincide y lo cargó una persona en el
--     sistema viejo, que es justo lo que el control de duplicados quería ver.
-- Si el CUIT está mal en la ficha y en los pedidos no engancha y sigue siendo a
-- mano.

create or replace function public.femway_reenganchar_cliente(p_codigo_viejo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_h   public.hist_clientes%rowtype;
  v_dig text;
  v_f   public.femway_clientes%rowtype;
begin
  select * into v_h from public.hist_clientes where codigo = p_codigo_viejo;
  if not found then return null; end if;

  v_dig := nullif(regexp_replace(coalesce(v_h.cuit, ''), '\D', '', 'g'), '');
  if v_dig is null or length(v_dig) <> 11 then return null; end if;

  select * into v_f from public.femway_clientes f
   where f.origen = 'nuevo'
     and (regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g') = v_dig
          or exists (select 1 from public.orders o
                      where o.proyecto = 'femway'
                        and ltrim(coalesce(o.client_code, ''), '0') = ltrim(f.codigo, '0')
                        and regexp_replace(coalesce(o.cuit, ''), '\D', '', 'g') = v_dig))
   order by f.codigo
   limit 1;
  if not found then return null; end if;

  -- Los pedidos primero, mientras se sabe cuál era el código viejo.
  update public.orders
     set client_code = ltrim(v_h.codigo, '0')
   where proyecto = 'femway'
     and ltrim(coalesce(client_code, ''), '0') = ltrim(v_f.codigo, '0');

  if exists (select 1 from public.femway_clientes where codigo = v_h.codigo) then
    -- Ya lo habían traído a mano con el código del sistema viejo: se queda ese,
    -- se le suman las notas y el 50xxx desaparece.
    update public.femway_clientes
       set notas      = coalesce(notas, v_f.notas),
           vendedor   = coalesce(vendedor, v_f.vendedor),
           pasado_el  = coalesce(pasado_el, current_date),
           updated_at = now()
     where codigo = v_h.codigo;
    delete from public.femway_clientes where codigo = v_f.codigo;
  else
    update public.femway_clientes set
      codigo            = v_h.codigo,
      razon_social      = v_h.razon_social,
      cuit              = nullif(btrim(replace(coalesce(v_h.cuit_formateado, v_h.cuit, ''), '*', '')), ''),
      domicilio         = v_h.domicilio,
      localidad         = v_h.localidad,
      telefonos         = v_h.telefonos,
      resp_compras      = v_h.resp_compras,
      entrega_domicilio = coalesce(v_h.entrega_domicilio, v_h.domicilio),
      entrega_localidad = coalesce(v_h.entrega_localidad, v_h.localidad),
      entrega_telefono  = v_h.entrega_telefono,
      zona              = v_h.zona,
      origen            = 'femavi',
      cliente_femavi    = v_h.codigo,
      pasado_el         = current_date,
      updated_at        = now()
    where codigo = v_f.codigo;
  end if;

  return v_f.codigo;
end;
$fn$;
revoke all on function public.femway_reenganchar_cliente(text) from public, anon, authenticated;

create or replace function public.hist_clientes_reenganche()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  perform public.femway_reenganchar_cliente(new.codigo);
  return null;
end;
$fn$;
revoke all on function public.hist_clientes_reenganche() from public, anon, authenticated;

drop trigger if exists hist_clientes_reenganche on public.hist_clientes;
create trigger hist_clientes_reenganche
  after insert or update of cuit on public.hist_clientes
  for each row execute function public.hist_clientes_reenganche();

-- Los que ya estaban esperando.
select public.femway_reenganchar_cliente(h.codigo)
  from public.hist_clientes h
 where length(regexp_replace(coalesce(h.cuit, ''), '\D', '', 'g')) = 11
   and regexp_replace(h.cuit, '\D', '', 'g') in (
         select regexp_replace(coalesce(f.cuit, ''), '\D', '', 'g')
           from public.femway_clientes f where f.origen = 'nuevo'
         union
         select regexp_replace(coalesce(o.cuit, ''), '\D', '', 'g')
           from public.orders o
           join public.femway_clientes f
             on f.origen = 'nuevo' and ltrim(coalesce(o.client_code, ''), '0') = ltrim(f.codigo, '0')
          where o.proyecto = 'femway');
