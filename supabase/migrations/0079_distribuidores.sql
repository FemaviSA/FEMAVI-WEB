-- Un distribuidor no es un vendedor: nos compra para revender. Mezclar las dos
-- cosas en "facturación de FemWay" no dice nada útil —una es lo que vendió el
-- equipo y la otra lo que compró un revendedor—, así que se separan.
--
-- Hoy el único es Sposito Jonatan (61), que carga sus pedidos con su propio
-- código de vendedor. Cuando haya más, alcanza con marcarlos acá.

alter table public.sellers
  add column if not exists es_distribuidor boolean not null default false;

comment on column public.sellers.es_distribuidor is
  'Nos compra para revender. Su facturación va aparte de la del equipo de vendedores.';

update public.sellers set es_distribuidor = true where code = '61' and proyecto = 'femway';
