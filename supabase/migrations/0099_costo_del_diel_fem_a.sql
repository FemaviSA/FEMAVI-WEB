-- DIEL FEM A es el DIEL FEM común de la lista de Quimwey, no el DIEL FEM E
-- (que es el DIEL SEC, $11.400). Santiago, 06/11/2026. Hacía falta para cerrar
-- octubre: el remito 138717 de CEMATIC lleva 30 kg.
insert into public.costos_quimwey (articulo, producto, costo, nota, actualizado_por)
values ('01013','DIEL FEM A', 5800, 'es el DIEL FEM común de la lista (Santiago, 06/11/2026)', 'santiago@femavi.com.ar'),
       ('01012','DIEL FEM',   5800, 'lista Quimwey 09-2026', 'santiago@femavi.com.ar')
on conflict (articulo) do update set costo = excluded.costo, nota = excluded.nota,
       actualizado_at = now(), actualizado_por = excluded.actualizado_por;
