-- Factura interna FEMAVI -> FemWay: una por mes, a costo de mercadería.
--
-- El costo sale de la lista de QUIMWEY, nuestro distribuidor: la misma lista
-- es el precio de venta a Quimwey y el costo para FemWay. NO es precios_lista,
-- que es la lista de venta de FemWay (la del control de precios).
--
-- Reglas (Santiago, 27 y 28/10/2026):
-- - Cuenta la fecha del comprobante del sistema viejo, no la del pedido: el
--   remito 138xxx, o el "papelito" 157xx-158xx de lo que sale sin remito
--   (C2, lo lleva el vendedor o va por Uber). Los papelitos entran igual.
-- - Va por lo que SALIÓ: el renglón en kilos negativos es bonificación y no
--   resta (30 kg con -5 kg bonificados son 30 kg de costo).
-- - Lo que sale sin cargo (muestras, dispenser, dosificador) entra al costo.
-- - Las notas de crédito (tipo 7 y 3) restan lo que vuelve.
-- - La primera factura es octubre 2026 y se lleva también lo de septiembre.
-- - No se suma el 5% de fraccionado en envases de 1 L / 1 kg.

create table if not exists public.costos_quimwey (
  articulo       text primary key,          -- código del sistema viejo (hist_articulos.codigo)
  producto       text not null,
  costo          numeric(14,2) check (costo >= 0),  -- por L/kg o por unidad
  nota           text,
  actualizado_at timestamptz not null default now(),
  actualizado_por text
);

alter table public.costos_quimwey enable row level security;
revoke all on table public.costos_quimwey from public, anon, authenticated;

-- Lista de Quimwey 09-2026, y a mano lo que no estaba en la lista (28/10/2026).
insert into public.costos_quimwey (articulo, producto, costo, nota) values
('01006','CHLOR FEM',7830,null),
('01015','DILUFEM',6000,null),
('01017','EMUL FEM',2250,null),
('01022','FIN GRAS PLUS',3550,null),
('01026','FOS FEM 10',4400,null),
('01027','GERMAX',5000,null),
('01035','LINDESS LIMON',3450,'LINDESS FRAG. VARIAS'),
('01048','RAX',4000,null),
('01061','BRIPEL',2400,null),
('01063','PULVERIZADOR',1500,null),
('01064','DOSIFICADOR',700,null),
('01065','ULTRA SKIN',4900,null),
('01083','DECAP GEL',18900,null),
('01103','DOSIFICADOR C/ULTRA SKIN',1300,'a mano'),
('01108','CITRIF',6400,null),
('01138','BARRICA 60 C/ZUNCHO',23000,null),
('01143','S-E-10',7100,null),
('01144','FOS FEM Mn',3850,null),
('01155','ANSOL',2800,'a mano'),
('01180','L-S-9',1900,'igual que L-S-9 NF'),
('01181','L-S-9 NF',1900,null),
('01199','CITRIFEM',6120,null),
('01415','DESINFECTANTE AE',1800,'a mano'),
('01587','CREMA CITRICA C/A',4928,'a mano'),
('01599','ULTRA SKIN E',2800,null),
('01745','TOP WASH',5615,'a mano'),
('01746','PINTA FACIL',2600,'a mano'),
('01816','DIEL FEM E',11400,'es el DIEL SEC'),
('01840','TOP 09',2450,null),
('01878','ULTRA SKIN PASTA',3040,'a mano'),
('02004','EFE D 1000',1900,null),
('04002','COLD FEM BE',8700,null),
('04003','COLD FEM LL',7200,null),
('04012','LUBRI STAMP 1/3',12400,null),
('04054','COLD FEM BLUE',4880,'a mano'),
('05002','C-X-20',12100,null),
('05096','GRASA EP470-ALUMINICA',10010,'a mano; no es la E.F.470 alimenticia'),
('06035','MULTICORTE (AER)',3446,'aerosol; el de la lista es a granel'),
('06098','ANTISOL',null,'falta el costo'),
('06206','DEXSSIL SINSIL',9570,'a mano'),
('08011','GERMICIDA PINO',4900,null),
('08022','SHAMPOO PARA AUTOS',3300,null),
('08036','CERISETTE',3180,null),
('08043','LAVAMANOS EXTRA SUAVE',4650,null),
('08049','BIDON VACIO 20 LITROS',6220,'precio por bidón'),
('08070','REMOVEDOR DE CERA',2800,null),
('09060','SKIN PINT',2600,'a mano'),
('09067','MR.WASH CLORADO',3350,null),
('09068','MR.WASH',2750,null),
('09075','DESENGRASANTE PARA Al.',3800,null),
('09940','DISPENSER DE PARED',9700,'a mano')
on conflict (articulo) do nothing;


-- La factura de un mes, armada.
create or replace function public.admin_factura_interna(p_mes date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_mes   date := date_trunc('month', coalesce(p_mes, current_date))::date;
  v_desde date;
  v_hasta date;
  v_res   jsonb;
begin
  if not public.is_admin() or public.admin_proyecto() is not null then
    raise exception 'no autorizado';
  end if;

  -- La primera (octubre 2026) se lleva todo lo anterior.
  v_desde := case when v_mes <= date '2026-10-01' then date '2000-01-01' else v_mes end;
  v_hasta := (v_mes + interval '1 month - 1 day')::date;

  with comp as (
    select c.clave, c.comprobante, c.pedido, c.fecha,
           case when c.tipo = '9' and c.comprobante >= 100000 then 'remito'
                when c.tipo = '9' then 'papelito'
                else 'nota_credito' end as clase,
           case when c.tipo = '9' then 1 else -1 end as signo,
           o.company as cliente, o.seller_code
      from public.hist_comprobantes c
      join public.orders o on o.order_number = c.pedido::text and o.proyecto = 'femway'
     where c.tipo in ('9','7','3')
       and c.fecha between v_desde and v_hasta
  ),
  ren as (
    select comp.*, r.linea, r.articulo,
           coalesce(k.producto, a.descripcion, r.articulo) as producto,
           r.kilos, r.precio = 0 as sin_cargo,
           k.costo,
           comp.signo * r.kilos as kg,
           comp.signo * r.kilos * k.costo as importe
      from comp
      join public.hist_renglones r on r.clave = comp.clave
      left join public.costos_quimwey k on k.articulo = r.articulo
      left join public.hist_articulos a on a.codigo = r.articulo
     where r.kilos > 0          -- los kilos negativos son bonificación: no restan
  )
  select jsonb_build_object(
    'mes', v_mes,
    'nombre', public.nombre_de_mes(v_mes),
    'desde', v_desde,
    'hasta', v_hasta,
    'ultimo_comprobante', (select max(fecha) from comp),
    'totales', jsonb_build_object(
      'costo',        coalesce((select sum(importe) from ren), 0),
      'remitos',      coalesce((select sum(importe) from ren where clase = 'remito'), 0),
      'papelitos',    coalesce((select sum(importe) from ren where clase = 'papelito'), 0),
      'notas_credito',coalesce((select sum(importe) from ren where clase = 'nota_credito'), 0),
      'sin_cargo',    coalesce((select sum(importe) from ren where sin_cargo), 0),
      'kg',           coalesce((select sum(kg) from ren), 0),
      'comprobantes', (select count(distinct clave) from ren)
    ),
    'sin_costo', (select coalesce(jsonb_agg(jsonb_build_object(
                     'articulo', articulo, 'producto', producto, 'kg', kg) order by kg desc), '[]'::jsonb)
                    from (select articulo, max(producto) as producto, sum(kg) as kg
                            from ren where costo is null group by articulo) s),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
                     'articulo', articulo, 'producto', producto, 'costo', costo,
                     'salio', salio, 'volvio', volvio, 'sin_cargo', sin_cargo, 'importe', importe)
                     order by importe desc nulls first), '[]'::jsonb)
                    from (select articulo, max(producto) as producto, max(costo) as costo,
                                 coalesce(sum(kilos) filter (where signo > 0), 0) as salio,
                                 coalesce(sum(kilos) filter (where signo < 0), 0) as volvio,
                                 coalesce(sum(kilos) filter (where signo > 0 and sin_cargo), 0) as sin_cargo,
                                 sum(importe) as importe
                            from ren group by articulo) p),
    'comprobantes', (select coalesce(jsonb_agg(jsonb_build_object(
                        'clase', clase, 'comprobante', comprobante, 'pedido', pedido, 'fecha', fecha,
                        'cliente', cliente, 'vendedor', seller_code, 'importe', importe,
                        'renglones', renglones) order by fecha, comprobante), '[]'::jsonb)
                       from (select clase, comprobante, pedido, fecha, cliente, seller_code,
                                    sum(importe) as importe,
                                    jsonb_agg(jsonb_build_object(
                                      'articulo', articulo, 'producto', producto, 'kg', kg,
                                      'costo', costo, 'importe', importe, 'sin_cargo', sin_cargo)
                                      order by linea) as renglones
                               from ren group by clave, clase, comprobante, pedido, fecha, cliente, seller_code) c)
  ) into v_res;

  return v_res;
end;
$function$;

revoke all on function public.admin_factura_interna(date) from public, anon, authenticated;
grant execute on function public.admin_factura_interna(date) to authenticated;


-- Cargar o corregir el costo de un artículo desde la pantalla.
create or replace function public.admin_guardar_costo_quimwey(p_articulo text, p_costo numeric)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_admin() or public.admin_proyecto() is not null then
    raise exception 'no autorizado';
  end if;
  if p_costo is not null and p_costo < 0 then raise exception 'costo invalido'; end if;

  insert into public.costos_quimwey (articulo, producto, costo, actualizado_at, actualizado_por)
  values (p_articulo,
          coalesce((select descripcion from public.hist_articulos where codigo = p_articulo), p_articulo),
          p_costo, now(), auth.jwt() ->> 'email')
  on conflict (articulo) do update
     set costo = excluded.costo, actualizado_at = now(), actualizado_por = excluded.actualizado_por;
end;
$function$;

revoke all on function public.admin_guardar_costo_quimwey(text, numeric) from public, anon, authenticated;
grant execute on function public.admin_guardar_costo_quimwey(text, numeric) to authenticated;
