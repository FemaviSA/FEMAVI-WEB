-- Facturación del admin: FEMAVI cuenta por ciclo, no por fecha de carga.
--
-- El ciclo de FEMAVI va adelante del almanaque: un pedido cargado el 24/11
-- puede ser del ciclo Diciembre, y uno del 29/10 del ciclo Noviembre. El admin
-- sumaba por fecha y no coincidía con Mis ventas ni con el equipo. Ahora, en
-- FEMAVI, p_desde y p_hasta se leen como meses de ciclo y cada pedido cae en
-- el ciclo que tiene escrito. Un pedido sin ciclo (los viejos, o uno que
-- todavía espera) cae en el mes en que se cargó. FemWay sigue por fecha.

create or replace function public.admin_facturacion(
  p_proyecto text, p_desde date, p_hasta date,
  p_vendedores text[] default null, p_canal text default 'vendedores')
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
declare
  v_proy  text;
  v_canal text := case when p_canal in ('vendedores','distribucion','todo') then p_canal else 'vendedores' end;
  v_vend  text[] := nullif(coalesce(p_vendedores, '{}'), '{}');
  v_desde date := coalesce(p_desde, date_trunc('month', current_date)::date);
  v_hasta date := coalesce(p_hasta, current_date);
  v_ciclo boolean;
  v_res   jsonb;
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;

  -- El admin de un solo proyecto mira el suyo, diga lo que diga el pedido.
  v_proy := coalesce(public.admin_proyecto(), p_proyecto, 'femavi');
  if v_proy not in ('femavi','femway') then raise exception 'proyecto invalido'; end if;
  v_ciclo := v_proy = 'femavi';

  with crudo as (
    select o.*,
           (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as dia
      from public.orders o
     where o.proyecto = v_proy
       and o.status <> 'rechazado'
  ),
  base as (
    select c.*,
           case when v_ciclo
                then coalesce(public.mes_de_nombre(c.sales_cycle), date_trunc('month', c.dia)::date)
                else date_trunc('month', c.dia)::date end as mes,
           coalesce((select s.es_distribuidor from public.sellers s
                      where s.code = c.seller_code and s.proyecto = c.proyecto), false) as distrib,
           -- Un mismo cliente puede venir con código, solo con CUIT o solo con nombre.
           coalesce(nullif(ltrim(btrim(c.client_code), '0'), ''),
                    nullif(regexp_replace(coalesce(c.cuit, ''), '\D', '', 'g'), ''),
                    lower(btrim(c.company))) as clave_cliente
      from crudo c
  ),
  filtrado as (
    select * from base
     where (case when v_ciclo
                 then mes between date_trunc('month', v_desde)::date and date_trunc('month', v_hasta)::date
                 else dia between v_desde and v_hasta end)
       and (v_canal = 'todo' or distrib = (v_canal = 'distribucion'))
       and (v_vend is null or coalesce(seller_code,'') = any(v_vend))
  ),
  ped as (select * from filtrado where status = 'aprobado'),
  espera as (select * from filtrado where status in ('recibido','a_confirmar')),
  renglones as (
    select ped.seller_code, ped.mes,
           nullif(btrim(i->>'product'), '') as producto,
           coalesce((i->>'quantity')::numeric, 0) as q,
           coalesce((i->>'line_total')::numeric, 0) as importe
      from ped, jsonb_array_elements(ped.items) i
  ),
  por_mes as (
    select mes, count(*) as pedidos, sum(total) as pesos from ped group by 1
  ),
  volumen_mes as (
    select mes, sum(q) as volumen from renglones group by 1
  )
  select jsonb_build_object(
    'proyecto', v_proy,
    'canal', v_canal,
    'por_ciclo', v_ciclo,
    'desde', v_desde,
    'hasta', v_hasta,
    'totales', jsonb_build_object(
      'pedidos',    (select count(*) from ped),
      'clientes',   (select count(distinct clave_cliente) from ped),
      'pesos',      (select coalesce(sum(total), 0) from ped),
      'volumen',    (select coalesce(sum(q), 0) from renglones),
      'bonificado', (select coalesce(-sum(q), 0) from renglones where q < 0)
    ),
    -- Lo que todavía no es facturación, para que se vea qué falta aprobar.
    'esperando', jsonb_build_object(
      'pedidos', (select count(*) from espera),
      'pesos',   (select coalesce(sum(total), 0) from espera),
      'a_confirmar', (select count(*) from espera where status = 'a_confirmar')
    ),
    'meses', (select coalesce(jsonb_agg(jsonb_build_object(
                 'mes', m.mes, 'nombre', public.nombre_de_mes(m.mes),
                 'pedidos', m.pedidos, 'pesos', m.pesos,
                 'volumen', coalesce(v.volumen, 0)) order by m.mes), '[]'::jsonb)
                from por_mes m left join volumen_mes v on v.mes = m.mes),
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object(
                      'code', v.code, 'name', v.name, 'es_distribuidor', v.es_distribuidor,
                      'pedidos', coalesce(x.pedidos, 0), 'clientes', coalesce(x.clientes, 0),
                      'pesos', coalesce(x.pesos, 0), 'volumen', coalesce(r.volumen, 0))
                      order by coalesce(x.pesos, 0) desc, lpad(v.code, 6, '0')), '[]'::jsonb)
                     from public.sellers v
                     left join (select seller_code, count(*) as pedidos,
                                       count(distinct clave_cliente) as clientes, sum(total) as pesos
                                  from ped group by seller_code) x on x.seller_code = v.code
                     left join (select seller_code, sum(q) as volumen
                                  from renglones group by seller_code) r on r.seller_code = v.code
                    where v.proyecto = v_proy
                      and (v_canal = 'todo' or v.es_distribuidor = (v_canal = 'distribucion'))
                      and (v_vend is null or v.code = any(v_vend))),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
                     'producto', producto, 'vendido', vendido, 'bonificado', bonificado, 'pesos', pesos)
                     order by pesos desc), '[]'::jsonb)
                    from (
                      select producto,
                             coalesce(sum(q) filter (where q > 0), 0)  as vendido,
                             coalesce(-sum(q) filter (where q < 0), 0) as bonificado,
                             coalesce(sum(importe), 0) as pesos
                        from renglones where producto is not null group by producto
                    ) pr),
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object(
                    'cliente', cliente, 'codigo', codigo, 'vendedor', vendedor,
                    'pedidos', pedidos, 'pesos', pesos, 'ultimo', ultimo)
                    order by pesos desc), '[]'::jsonb)
                   from (
                     select (array_agg(company order by created_at desc))[1] as cliente,
                            (array_agg(client_code order by created_at desc)
                               filter (where client_code is not null))[1] as codigo,
                            (array_agg(seller_code order by created_at desc))[1] as vendedor,
                            count(*) as pedidos, sum(total) as pesos, max(dia) as ultimo
                       from ped group by clave_cliente
                   ) c)
  ) into v_res;

  return v_res;
end;
$$;

-- El ciclo en curso que ve el admin: si eligió un solo vendedor, el de ese
-- vendedor (cada uno cierra el suyo); si no, el del equipo, como el gerente.
create or replace function public.admin_ciclo_actual(p_vendedores text[] default null)
returns date
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'no autorizado'; end if;
  return public.ciclo_femavi_actual(
    case when cardinality(p_vendedores) = 1 then p_vendedores[1] end);
end;
$$;

revoke all on function public.admin_ciclo_actual(text[]) from public, anon;
grant execute on function public.admin_ciclo_actual(text[]) to authenticated;
