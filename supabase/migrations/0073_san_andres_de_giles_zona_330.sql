-- San Andrés de Giles va a la zona 330, con Pilar, General Rodríguez y Luján
-- (Santiago, 27/10/2026). Entran las localidades del partido según Georef y
-- "Giles" a secas, que es como se escribe. "San Andrés" sin más sigue siendo
-- Villa San Andrés (San Martín, 370): la clave más larga gana al buscar, así
-- que "San Andrés de Giles" no se confunde.

update public.femway_zonas
   set nombre = 'Pilar, General Rodríguez, Luján, San Andrés de Giles'
 where codigo = '330';

insert into public.femway_zona_lugares (clave, nombre, partido, zona, origen)
select public.femway_normalizar(n), n, 'San Andrés de Giles', '330', o
  from (values
    ('San Andrés de Giles', 'partido'),
    ('Giles', 'alias'),
    ('Azcuénaga', 'georef'),
    ('Cucullú', 'georef'),
    ('Franklin', 'georef'),
    ('Solís', 'georef'),
    ('Villa Espil', 'georef'),
    ('Villa Ruiz', 'georef')
  ) v (n, o)
on conflict (clave) do update set
  nombre = excluded.nombre, partido = excluded.partido,
  zona = excluded.zona, origen = excluded.origen;

-- Los de Giles que ya estaban cargados: el trigger solo recalcula cuando cambia
-- la localidad, así que se completan acá. Solo los de estas localidades: una
-- zona corregida a mano en otro lado no se toca.
update public.femway_clientes
   set zona = public.femway_zona_de(coalesce(entrega_localidad, localidad))
 where public.femway_normalizar(coalesce(entrega_localidad, localidad)) ~ '(GILES|AZCUENAGA|CUCULLU|FRANKLIN|SOLIS|VILLA ESPIL|VILLA RUIZ)'
   and public.femway_zona_de(coalesce(entrega_localidad, localidad)) = '330';

update public.orders
   set zone = public.femway_zona_de(ship_city)
 where proyecto = 'femway'
   and public.femway_normalizar(ship_city) ~ '(GILES|AZCUENAGA|CUCULLU|FRANKLIN|SOLIS|VILLA ESPIL|VILLA RUIZ)'
   and public.femway_zona_de(ship_city) = '330';
