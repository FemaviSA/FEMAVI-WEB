-- Baradero va a la zona 320, con Escobar, Campana y Zárate (Santiago, 14/10/2026).
-- Entran las localidades del partido según Georef; se dejan afuera los parajes
-- con nombres que se confunden con otros lados (El Caballito, La Paloma…).

update public.femway_zonas
   set nombre = 'Escobar, Campana, Zárate, Baradero'
 where codigo = '320';

insert into public.femway_zona_lugares (clave, nombre, partido, zona, origen)
select public.femway_normalizar(n), n, 'Baradero', '320', o
  from (values
    ('Baradero', 'partido'),
    ('Irineo Portela', 'georef'),
    ('Santa Coloma', 'georef'),
    ('Villa Alsina', 'georef'),
    ('Colonia Suiza', 'georef'),
    ('Sáenz Valiente', 'georef')
  ) v (n, o)
on conflict (clave) do update set
  nombre = excluded.nombre, partido = excluded.partido,
  zona = excluded.zona, origen = excluded.origen;

-- Los de Baradero que ya estaban cargados quedaron sin zona: el trigger solo
-- recalcula cuando cambia la localidad, así que se completan acá.
update public.femway_clientes
   set zona = public.femway_zona_de(coalesce(entrega_localidad, localidad))
 where zona is null;

update public.orders
   set zone = public.femway_zona_de(ship_city)
 where proyecto = 'femway' and zone is null;
