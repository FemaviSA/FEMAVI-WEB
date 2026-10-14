-- Zonas de reparto de FemWay.
--
-- Santiago las definió el 14/10/2026 por partido (y La Matanza partida por
-- localidad). Reemplazan a los códigos que venían del sistema viejo (101, 113…),
-- que para FemWay no significan nada. La zona sale sola de la localidad de
-- ENTREGA: del pedido (ship_city) y de la ficha del cliente
-- (entrega_localidad, o la fiscal si no hay otra).
--
-- En la carga se escribe la localidad ("Munro", "Wilde Avellaneda", "Lomas
-- Mirador Bs As"), no el partido. Por eso hay una tabla que traduce cada
-- localidad a su zona: sale del listado oficial (API Georef: localidades y
-- asentamientos BAHRA de cada partido), más los nombres de los partidos y las
-- formas en que se escriben de verdad.
--
-- Quedan afuera a propósito los nombres que están en dos partidos de zonas
-- distintas (Del Viso, Tortuguitas, San Francisco Solano, El Tropezón,
-- Remedios de Escalada, Santa Rosa, Cuartel V) y "La Matanza" a secas, que se
-- reparte en cinco zonas: esos quedan sin zona y se ponen a mano.
--
-- Si la localidad no se reconoce, la zona que se haya escrito a mano queda
-- (si es un código de esta lista); un código viejo se borra.

create table if not exists public.femway_zonas (
  codigo text primary key,
  nombre text not null
);

insert into public.femway_zonas (codigo, nombre) values
  ('300', 'CABA'),
  ('310', 'Vicente López, San Isidro, San Fernando, Tigre'),
  ('320', 'Escobar, Campana, Zárate'),
  ('330', 'Pilar, General Rodríguez, Luján'),
  ('340', 'Moreno, Merlo, Marcos Paz'),
  ('350', 'Malvinas Argentinas, San Miguel, José C. Paz'),
  ('360', 'Hurlingham, Morón, Ituzaingó'),
  ('370', 'Tres de Febrero, San Martín'),
  ('380', 'La Plata, Berisso, Ensenada'),
  ('390', 'Ezeiza, San Vicente, Esteban Echeverría'),
  ('400', 'Avellaneda, Lanús, Lomas de Zamora'),
  ('410', 'Almirante Brown, Florencio Varela'),
  ('420', 'Quilmes, Berazategui'),
  ('430', 'Ramos Mejía, Lomas del Mirador, La Tablada, Villa Madero, Villa Celina, Tapiales, Aldo Bonzi'),
  ('440', 'Villa Luzuriaga, San Justo, Isidro Casanova, Rafael Castillo'),
  ('450', 'Ciudad Evita, Gregorio de Laferrere'),
  ('460', 'González Catán, 20 de Junio'),
  ('470', 'Virrey del Pino, Cañuelas')
on conflict (codigo) do update set nombre = excluded.nombre;

-- Una localidad, ya normalizada, y su zona.
create table if not exists public.femway_zona_lugares (
  clave   text primary key,
  nombre  text not null,
  partido text,
  zona    text not null references public.femway_zonas (codigo),
  -- 'georef', 'partido', 'alias' o 'caba': de dónde salió.
  origen  text not null
);

alter table public.femway_zonas enable row level security;
alter table public.femway_zona_lugares enable row level security;
revoke all on table public.femway_zonas from public, anon, authenticated;
revoke all on table public.femway_zona_lugares from public, anon, authenticated;

-- ── Normalizar una localidad ──
-- Mayúsculas, sin acentos ni signos, y las abreviaturas de siempre escritas
-- enteras: "Gral. Rodríguez" y "GENERAL RODRIGUEZ" dan lo mismo.

create or replace function public.femway_normalizar(p text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select btrim(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(
      ' ' || regexp_replace(
        translate(upper(coalesce(p, '')), 'ÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ', 'AAAAAEEEEIIIIOOOOOUUUUNC'),
        '[^A-Z0-9]+', ' ', 'g') || ' ',
      ' GRAL ', ' GENERAL ', 'g'),
      ' ING ', ' INGENIERO ', 'g'),
      ' PTE ', ' PRESIDENTE ', 'g'),
      ' VA ', ' VILLA ', 'g'),
      ' STA ', ' SANTA ', 'g'),
      ' ALTE ', ' ALMIRANTE ', 'g'),
      ' FCIO ', ' FLORENCIO ', 'g'),
      ' CNEL ', ' CORONEL ', 'g'),
    ' +', ' ', 'g'));
$fn$;

-- La lista: cada nombre se normaliza, y si un nombre cae en dos zonas
-- distintas no entra (es ambiguo; mejor sin zona que con una equivocada).
with crudo (nombre, zona, partido, origen) as (values
  ('Carapachay', '310', 'Vicente López', 'georef'),
  ('Florida', '310', 'Vicente López', 'georef'),
  ('Florida Oeste', '310', 'Vicente López', 'georef'),
  ('La Lucila', '310', 'Vicente López', 'georef'),
  ('Munro', '310', 'Vicente López', 'georef'),
  ('Olivos', '310', 'Vicente López', 'georef'),
  ('Vicente López', '310', 'Vicente López', 'georef'),
  ('Villa Adelina', '310', 'Vicente López', 'georef'),
  ('Villa Martelli', '310', 'Vicente López', 'georef'),
  ('Acasusso', '310', 'San Isidro', 'georef'),
  ('Béccar', '310', 'San Isidro', 'georef'),
  ('Boulogne Sur Mer', '310', 'San Isidro', 'georef'),
  ('Martínez', '310', 'San Isidro', 'georef'),
  ('San Isidro', '310', 'San Isidro', 'georef'),
  ('San Fernando', '310', 'San Fernando', 'georef'),
  ('Victoria', '310', 'San Fernando', 'georef'),
  ('Virreyes', '310', 'San Fernando', 'georef'),
  ('Arroyo Durazno', '310', 'San Fernando', 'georef'),
  ('Arroyo Felicaria', '310', 'San Fernando', 'georef'),
  ('Arroyo Las Cañas', '310', 'San Fernando', 'georef'),
  ('Arroyo Pay Carabí', '310', 'San Fernando', 'georef'),
  ('La Barquita', '310', 'San Fernando', 'georef'),
  ('Manzano de la Barca', '310', 'San Fernando', 'georef'),
  ('Nueva Esperanza', '310', 'San Fernando', 'georef'),
  ('Paraná Mini', '310', 'San Fernando', 'georef'),
  ('Río Carabelas', '310', 'San Fernando', 'georef'),
  ('3° Sección de Islas', '310', 'San Fernando', 'georef'),
  ('Benavídez', '310', 'Tigre', 'georef'),
  ('Dique Luján', '310', 'Tigre', 'georef'),
  ('Don Torcuato Este', '310', 'Tigre', 'georef'),
  ('Don Torcuato Oeste', '310', 'Tigre', 'georef'),
  ('El Talar', '310', 'Tigre', 'georef'),
  ('General Pacheco', '310', 'Tigre', 'georef'),
  ('Troncos del Talar', '310', 'Tigre', 'georef'),
  ('Ricardo Rojas', '310', 'Tigre', 'georef'),
  ('Rincón de Milberg', '310', 'Tigre', 'georef'),
  ('Tigre', '310', 'Tigre', 'georef'),
  ('Belén de Escobar', '320', 'Escobar', 'georef'),
  ('El Cazador', '320', 'Escobar', 'georef'),
  ('Garín', '320', 'Escobar', 'georef'),
  ('Ingeniero Maschwitz', '320', 'Escobar', 'georef'),
  ('Loma Verde', '320', 'Escobar', 'georef'),
  ('Matheu', '320', 'Escobar', 'georef'),
  ('Maquinista F. Savio Este', '320', 'Escobar', 'georef'),
  ('Escobar', '320', 'Escobar', 'georef'),
  ('Puerto Paraná', '320', 'Escobar', 'georef'),
  ('Los Cardales', '320', 'Campana', 'georef'),
  ('Barrio Los Pioneros (Barrio Tavella)', '320', 'Campana', 'georef'),
  ('Campana', '320', 'Campana', 'georef'),
  ('Chacras del Río Luján', '320', 'Campana', 'georef'),
  ('Río Luján', '320', 'Campana', 'georef'),
  ('Blondeau', '320', 'Campana', 'georef'),
  ('El Morejón', '320', 'Campana', 'georef'),
  ('Isla Talavera', '320', 'Campana', 'georef'),
  ('La Granja', '320', 'Campana', 'georef'),
  ('Barrio Saavedra', '320', 'Zárate', 'georef'),
  ('Zárate', '320', 'Zárate', 'georef'),
  ('Escalada', '320', 'Zárate', 'georef'),
  ('Lima', '320', 'Zárate', 'georef'),
  ('Country Club El Casco', '320', 'Zárate', 'georef'),
  ('Atucha', '320', 'Zárate', 'georef'),
  ('Barrio Naútico Talavera', '320', 'Zárate', 'georef'),
  ('Chacras de Olivia', '320', 'Zárate', 'georef'),
  ('Chacras del Paraná', '320', 'Zárate', 'georef'),
  ('Cuartel V', '320', 'Zárate', 'georef'),
  ('El Tatú', '320', 'Zárate', 'georef'),
  ('Estación Atucha', '320', 'Zárate', 'georef'),
  ('Haras Pozo de Luna', '320', 'Zárate', 'georef'),
  ('Isla Botija', '320', 'Zárate', 'georef'),
  ('Keidel', '320', 'Zárate', 'georef'),
  ('Las Cuatro Esquinas', '320', 'Zárate', 'georef'),
  ('Las Islas', '320', 'Zárate', 'georef'),
  ('Las Palmas', '320', 'Zárate', 'georef'),
  ('Puente Urquiza', '320', 'Zárate', 'georef'),
  ('Puerto Las Palmas', '320', 'Zárate', 'georef'),
  ('Puerto Lima', '320', 'Zárate', 'georef'),
  ('Del Viso', '330', 'Pilar', 'georef'),
  ('Fátima', '330', 'Pilar', 'georef'),
  ('La Lonja', '330', 'Pilar', 'georef'),
  ('Los Cachorros', '330', 'Pilar', 'georef'),
  ('Manzanares', '330', 'Pilar', 'georef'),
  ('Manzone', '330', 'Pilar', 'georef'),
  ('Maquinista F. Savio Oeste', '330', 'Pilar', 'georef'),
  ('Pilar', '330', 'Pilar', 'georef'),
  ('Presidente Derqui', '330', 'Pilar', 'georef'),
  ('Roberto de Vicenzo', '330', 'Pilar', 'georef'),
  ('Santa Teresa', '330', 'Pilar', 'georef'),
  ('Tortuguitas', '330', 'Pilar', 'georef'),
  ('Villa Astolfi', '330', 'Pilar', 'georef'),
  ('Villa Rosa', '330', 'Pilar', 'georef'),
  ('Zelaya', '330', 'Pilar', 'georef'),
  ('Barrio Morabo', '330', 'General Rodríguez', 'georef'),
  ('Barrio Ruta 24 Kilómetro 10', '330', 'General Rodríguez', 'georef'),
  ('Country Club Bosque Real', '330', 'General Rodríguez', 'georef'),
  ('General Rodríguez', '330', 'General Rodríguez', 'georef'),
  ('Cuartel II', '330', 'General Rodríguez', 'georef'),
  ('De Arias', '330', 'General Rodríguez', 'georef'),
  ('Barrio Las Casuarinas', '330', 'Luján', 'georef'),
  ('Cortines', '330', 'Luján', 'georef'),
  ('Lezica y Torrezuri', '330', 'Luján', 'georef'),
  ('Luján', '330', 'Luján', 'georef'),
  ('Villa Flandria Norte', '330', 'Luján', 'georef'),
  ('Villa Flandria Sur', '330', 'Luján', 'georef'),
  ('Country Club Las Praderas', '330', 'Luján', 'georef'),
  ('Open Door', '330', 'Luján', 'georef'),
  ('Carlos Keen', '330', 'Luján', 'georef'),
  ('Olivera', '330', 'Luján', 'georef'),
  ('Torres', '330', 'Luján', 'georef'),
  ('Club de Campo Los Puentes', '330', 'Luján', 'georef'),
  ('Alastuey', '330', 'Luján', 'georef'),
  ('Cañada de Roca', '330', 'Luján', 'georef'),
  ('Las Lilas', '330', 'Luján', 'georef'),
  ('San Eladio', '330', 'Luján', 'georef'),
  ('Sucre', '330', 'Luján', 'georef'),
  ('Cuartel V', '340', 'Moreno', 'georef'),
  ('Francisco Álvarez', '340', 'Moreno', 'georef'),
  ('La Reja', '340', 'Moreno', 'georef'),
  ('Moreno', '340', 'Moreno', 'georef'),
  ('Paso del Rey', '340', 'Moreno', 'georef'),
  ('Trujui', '340', 'Moreno', 'georef'),
  ('Libertad', '340', 'Merlo', 'georef'),
  ('Mariano Acosta', '340', 'Merlo', 'georef'),
  ('Merlo', '340', 'Merlo', 'georef'),
  ('Pontevedra', '340', 'Merlo', 'georef'),
  ('San Antonio de Padua', '340', 'Merlo', 'georef'),
  ('Barrio Lisandro de la Torre y Santa Marta', '340', 'Marcos Paz', 'georef'),
  ('Marcos Paz', '340', 'Marcos Paz', 'georef'),
  ('Barrio Santa Rosa', '340', 'Marcos Paz', 'georef'),
  ('Alambrado de Fierro', '340', 'Marcos Paz', 'georef'),
  ('El Tropezón', '340', 'Marcos Paz', 'georef'),
  ('Elías Romero', '340', 'Marcos Paz', 'georef'),
  ('La Colorada', '340', 'Marcos Paz', 'georef'),
  ('Área de Promoción El Triángulo', '350', 'Malvinas Argentinas', 'georef'),
  ('Grand Bourg', '350', 'Malvinas Argentinas', 'georef'),
  ('Ingeniero Adolfo Sourdeaux', '350', 'Malvinas Argentinas', 'georef'),
  ('Ingeniero Pablo Nogués', '350', 'Malvinas Argentinas', 'georef'),
  ('Los Polvorines', '350', 'Malvinas Argentinas', 'georef'),
  ('Malvinas Argentinas', '350', 'Malvinas Argentinas', 'georef'),
  ('Tortuguitas', '350', 'Malvinas Argentinas', 'georef'),
  ('Villa de Mayo', '350', 'Malvinas Argentinas', 'georef'),
  ('Bella Vista', '350', 'San Miguel', 'georef'),
  ('Campo de Mayo', '350', 'San Miguel', 'georef'),
  ('Muñiz', '350', 'San Miguel', 'georef'),
  ('San Miguel', '350', 'San Miguel', 'georef'),
  ('Del Viso', '350', 'José C. Paz', 'georef'),
  ('José C. Paz', '350', 'José C. Paz', 'georef'),
  ('Hurlingham', '360', 'Hurlingham', 'georef'),
  ('Villa Santos Tesei', '360', 'Hurlingham', 'georef'),
  ('William C. Morris', '360', 'Hurlingham', 'georef'),
  ('Morón', '360', 'Morón', 'georef'),
  ('Castelar', '360', 'Morón', 'georef'),
  ('El Palomar', '360', 'Morón', 'georef'),
  ('Haedo', '360', 'Morón', 'georef'),
  ('Villa Sarmiento', '360', 'Morón', 'georef'),
  ('Ituzaingó Centro', '360', 'Ituzaingó', 'georef'),
  ('Ituzaingó Sur', '360', 'Ituzaingó', 'georef'),
  ('Villa Gobernador Udadondo', '360', 'Ituzaingó', 'georef'),
  ('Ituzaingó', '360', 'Ituzaingó', 'georef'),
  ('Caseros', '370', 'Tres de Febrero', 'georef'),
  ('Churruca', '370', 'Tres de Febrero', 'georef'),
  ('Ciudad Jardín Lomas del Palomar', '370', 'Tres de Febrero', 'georef'),
  ('Ciudadela', '370', 'Tres de Febrero', 'georef'),
  ('El Libertador', '370', 'Tres de Febrero', 'georef'),
  ('José Ingenieros', '370', 'Tres de Febrero', 'georef'),
  ('Loma Hermosa', '370', 'Tres de Febrero', 'georef'),
  ('Martín Coronado', '370', 'Tres de Febrero', 'georef'),
  ('11 de Septiembre', '370', 'Tres de Febrero', 'georef'),
  ('Pablo Podestá', '370', 'Tres de Febrero', 'georef'),
  ('Remedios de Escalada', '370', 'Tres de Febrero', 'georef'),
  ('Sáenz Peña', '370', 'Tres de Febrero', 'georef'),
  ('Santos Lugares', '370', 'Tres de Febrero', 'georef'),
  ('Villa Bosch', '370', 'Tres de Febrero', 'georef'),
  ('Villa Raffo', '370', 'Tres de Febrero', 'georef'),
  ('Tres de Febrero', '370', 'Tres de Febrero', 'georef'),
  ('Villa Yapeyú', '370', 'General San Martín', 'georef'),
  ('Barrio Parque General San Martín', '370', 'General San Martín', 'georef'),
  ('Billinghurst', '370', 'General San Martín', 'georef'),
  ('Ciudad del Libertador General San Martín', '370', 'General San Martín', 'georef'),
  ('Ciudad Jardín El Libertador', '370', 'General San Martín', 'georef'),
  ('Villa Ayacucho', '370', 'General San Martín', 'georef'),
  ('Villa Ballester', '370', 'General San Martín', 'georef'),
  ('Villa Bernardo Monteagudo', '370', 'General San Martín', 'georef'),
  ('Villa Chacabuco', '370', 'General San Martín', 'georef'),
  ('Villa Coronel José M. Zapiola', '370', 'General San Martín', 'georef'),
  ('Villa General Antonio J. de Sucre', '370', 'General San Martín', 'georef'),
  ('Villa General Eugenio Necochea', '370', 'General San Martín', 'georef'),
  ('Villa General José Tomás Guido', '370', 'General San Martín', 'georef'),
  ('Villa General Juan G. Las Heras', '370', 'General San Martín', 'georef'),
  ('Villa Godoy Cruz', '370', 'General San Martín', 'georef'),
  ('Villa Granaderos de San Martín', '370', 'General San Martín', 'georef'),
  ('Villa Gregoria Matorras', '370', 'General San Martín', 'georef'),
  ('Villa José León Suárez', '370', 'General San Martín', 'georef'),
  ('Villa Juan Martín de Pueyrredón', '370', 'General San Martín', 'georef'),
  ('Villa Libertad', '370', 'General San Martín', 'georef'),
  ('Villa Lynch', '370', 'General San Martín', 'georef'),
  ('Villa Maipú', '370', 'General San Martín', 'georef'),
  ('Va.María Irene de los Remedios Escalada', '370', 'General San Martín', 'georef'),
  ('Va.Marqués Alejandro María de Aguado', '370', 'General San Martín', 'georef'),
  ('Villa Parque Presidente Figueroa Alcorta', '370', 'General San Martín', 'georef'),
  ('Villa Parque San Lorenzo', '370', 'General San Martín', 'georef'),
  ('Villa San Andrés', '370', 'General San Martín', 'georef'),
  ('General San Martín', '370', 'General San Martín', 'georef'),
  ('Barrio Gambier', '380', 'La Plata', 'georef'),
  ('Abasto', '380', 'La Plata', 'georef'),
  ('Ángel Etcheverry', '380', 'La Plata', 'georef'),
  ('Arana', '380', 'La Plata', 'georef'),
  ('Arturo Seguí', '380', 'La Plata', 'georef'),
  ('Barrio El Carmen Oeste', '380', 'La Plata', 'georef'),
  ('Barrio Las Malvinas', '380', 'La Plata', 'georef'),
  ('Barrio Las Quintas', '380', 'La Plata', 'georef'),
  ('City Bell', '380', 'La Plata', 'georef'),
  ('El Retiro', '380', 'La Plata', 'georef'),
  ('Joaquín Gorina', '380', 'La Plata', 'georef'),
  ('José Hernández', '380', 'La Plata', 'georef'),
  ('José Melchor Romero', '380', 'La Plata', 'georef'),
  ('La Cumbre', '380', 'La Plata', 'georef'),
  ('La Plata', '380', 'La Plata', 'georef'),
  ('Lisandro Olmos', '380', 'La Plata', 'georef'),
  ('Los Hornos', '380', 'La Plata', 'georef'),
  ('Manuel B. Gonnet', '380', 'La Plata', 'georef'),
  ('Ringuelet', '380', 'La Plata', 'georef'),
  ('Rufino de Elizalde', '380', 'La Plata', 'georef'),
  ('Tolosa', '380', 'La Plata', 'georef'),
  ('Transradio', '380', 'La Plata', 'georef'),
  ('Villa Elisa', '380', 'La Plata', 'georef'),
  ('Villa Elvira', '380', 'La Plata', 'georef'),
  ('Villa Garibaldi', '380', 'La Plata', 'georef'),
  ('Villa Montoro', '380', 'La Plata', 'georef'),
  ('Villa Parque Sicardi', '380', 'La Plata', 'georef'),
  ('Country Club El Rodeo', '380', 'La Plata', 'georef'),
  ('Ignacio Correas', '380', 'La Plata', 'georef'),
  ('Lomas de Copello', '380', 'La Plata', 'georef'),
  ('Ruta Sol', '380', 'La Plata', 'georef'),
  ('Buchanan', '380', 'La Plata', 'georef'),
  ('Esquina Negra', '380', 'La Plata', 'georef'),
  ('La Providencia', '380', 'La Plata', 'georef'),
  ('Martín García', '380', 'La Plata', 'georef'),
  ('Poblet', '380', 'La Plata', 'georef'),
  ('Barrio Banco Provincia', '380', 'Berisso', 'georef'),
  ('Barrio El Carmen Este', '380', 'Berisso', 'georef'),
  ('Barrio Universitario', '380', 'Berisso', 'georef'),
  ('Berisso', '380', 'Berisso', 'georef'),
  ('Los Talas', '380', 'Berisso', 'georef'),
  ('Villa Argüello', '380', 'Berisso', 'georef'),
  ('Villa Dolores', '380', 'Berisso', 'georef'),
  ('Villa Independencia', '380', 'Berisso', 'georef'),
  ('Villa Nueva', '380', 'Berisso', 'georef'),
  ('Villa Porteña', '380', 'Berisso', 'georef'),
  ('Villa Progreso', '380', 'Berisso', 'georef'),
  ('Villa San Carlos', '380', 'Berisso', 'georef'),
  ('Villa Zula', '380', 'Berisso', 'georef'),
  ('Balneario La Balandra', '380', 'Berisso', 'georef'),
  ('Balneario Municipal', '380', 'Berisso', 'georef'),
  ('Isla Paulino', '380', 'Berisso', 'georef'),
  ('La Hermosura', '380', 'Berisso', 'georef'),
  ('Palo Blanco', '380', 'Berisso', 'georef'),
  ('Playa Bagliardi', '380', 'Berisso', 'georef'),
  ('Dique N° 1', '380', 'Ensenada', 'georef'),
  ('Ensenada', '380', 'Ensenada', 'georef'),
  ('Isla Santiago', '380', 'Ensenada', 'georef'),
  ('Punta Lara', '380', 'Ensenada', 'georef'),
  ('Villa Catela', '380', 'Ensenada', 'georef'),
  ('Aeropuerto Internacional Ezeiza', '390', 'Ezeiza', 'georef'),
  ('Canning', '390', 'Ezeiza', 'georef'),
  ('Carlos Spegazzini', '390', 'Ezeiza', 'georef'),
  ('José María Ezeiza', '390', 'Ezeiza', 'georef'),
  ('La Unión', '390', 'Ezeiza', 'georef'),
  ('Tristán Suárez', '390', 'Ezeiza', 'georef'),
  ('Ezeiza', '390', 'Ezeiza', 'georef'),
  ('El Porvenir', '390', 'Ezeiza', 'georef'),
  ('Alejandro Korn', '390', 'San Vicente', 'georef'),
  ('San Vicente', '390', 'San Vicente', 'georef'),
  ('Domselaar', '390', 'San Vicente', 'georef'),
  ('Campo Arechaval', '390', 'San Vicente', 'georef'),
  ('El Ombú', '390', 'San Vicente', 'georef'),
  ('Puente 11 Bocas', '390', 'San Vicente', 'georef'),
  ('Santa Rosa', '390', 'San Vicente', 'georef'),
  ('El Jagüel', '390', 'Esteban Echeverría', 'georef'),
  ('Luis Guillón', '390', 'Esteban Echeverría', 'georef'),
  ('Monte Grande', '390', 'Esteban Echeverría', 'georef'),
  ('9 de Abril', '390', 'Esteban Echeverría', 'georef'),
  ('Esteban Echeverría', '390', 'Esteban Echeverría', 'georef'),
  ('Gerli', '400', 'Avellaneda', 'georef'),
  ('Piñeyro', '400', 'Avellaneda', 'georef'),
  ('Sarandí', '400', 'Avellaneda', 'georef'),
  ('Villa Domínico', '400', 'Avellaneda', 'georef'),
  ('Wilde', '400', 'Avellaneda', 'georef'),
  ('Área Reserva Cinturón Ecológico', '400', 'Avellaneda', 'georef'),
  ('Avellaneda', '400', 'Avellaneda', 'georef'),
  ('Crucesita', '400', 'Avellaneda', 'georef'),
  ('Dock Sud', '400', 'Avellaneda', 'georef'),
  ('Lanús Este', '400', 'Lanús', 'georef'),
  ('Lanús Oeste', '400', 'Lanús', 'georef'),
  ('Monte Chingolo', '400', 'Lanús', 'georef'),
  ('Remedios de Escalada de San Martín', '400', 'Lanús', 'georef'),
  ('Valentín Alsina', '400', 'Lanús', 'georef'),
  ('Lanús', '400', 'Lanús', 'georef'),
  ('Banfield', '400', 'Lomas de Zamora', 'georef'),
  ('Llavallol', '400', 'Lomas de Zamora', 'georef'),
  ('Lomas de Zamora', '400', 'Lomas de Zamora', 'georef'),
  ('Temperley', '400', 'Lomas de Zamora', 'georef'),
  ('Turdera', '400', 'Lomas de Zamora', 'georef'),
  ('Villa Centenario', '400', 'Lomas de Zamora', 'georef'),
  ('Villa Fiorito', '400', 'Lomas de Zamora', 'georef'),
  ('Ministro Rivadavia', '410', 'Almirante Brown', 'georef'),
  ('Adrogué', '410', 'Almirante Brown', 'georef'),
  ('Burzaco', '410', 'Almirante Brown', 'georef'),
  ('Claypole', '410', 'Almirante Brown', 'georef'),
  ('Don Orione', '410', 'Almirante Brown', 'georef'),
  ('Glew', '410', 'Almirante Brown', 'georef'),
  ('José Mármol', '410', 'Almirante Brown', 'georef'),
  ('Longchamps', '410', 'Almirante Brown', 'georef'),
  ('Rafael Calzada', '410', 'Almirante Brown', 'georef'),
  ('San Francisco Solano', '410', 'Almirante Brown', 'georef'),
  ('San José', '410', 'Almirante Brown', 'georef'),
  ('Almirante Brown', '410', 'Almirante Brown', 'georef'),
  ('Bosques', '410', 'Florencio Varela', 'georef'),
  ('Estanislao Severo Zeballos', '410', 'Florencio Varela', 'georef'),
  ('San Juan Bautista', '410', 'Florencio Varela', 'georef'),
  ('Gobernador Julio A. Costa', '410', 'Florencio Varela', 'georef'),
  ('Ingeniero Juan Allan', '410', 'Florencio Varela', 'georef'),
  ('Villa Brown', '410', 'Florencio Varela', 'georef'),
  ('Villa San Luis', '410', 'Florencio Varela', 'georef'),
  ('Villa Santa Rosa', '410', 'Florencio Varela', 'georef'),
  ('Villa Vatteone', '410', 'Florencio Varela', 'georef'),
  ('El Tropezón', '410', 'Florencio Varela', 'georef'),
  ('La Capilla', '410', 'Florencio Varela', 'georef'),
  ('Florencio Varela', '410', 'Florencio Varela', 'georef'),
  ('Bernal', '420', 'Quilmes', 'georef'),
  ('Bernal Oeste', '420', 'Quilmes', 'georef'),
  ('Don Bosco', '420', 'Quilmes', 'georef'),
  ('Ezpeleta', '420', 'Quilmes', 'georef'),
  ('Ezpeleta Oeste', '420', 'Quilmes', 'georef'),
  ('Quilmes', '420', 'Quilmes', 'georef'),
  ('Quilmes Oeste', '420', 'Quilmes', 'georef'),
  ('San Francisco Solano', '420', 'Quilmes', 'georef'),
  ('Villa La Florida', '420', 'Quilmes', 'georef'),
  ('Berazategui', '420', 'Berazategui', 'georef'),
  ('Berazategui Oeste', '420', 'Berazategui', 'georef'),
  ('Carlos Tomás Sourigues', '420', 'Berazategui', 'georef'),
  ('El Pato', '420', 'Berazategui', 'georef'),
  ('Guillermo Enrique Hudson', '420', 'Berazategui', 'georef'),
  ('Juan María Gutiérrez', '420', 'Berazategui', 'georef'),
  ('Pereyra', '420', 'Berazategui', 'georef'),
  ('Plátanos', '420', 'Berazategui', 'georef'),
  ('Ranelagh', '420', 'Berazategui', 'georef'),
  ('Villa España', '420', 'Berazategui', 'georef'),
  ('Costa de Hudson', '420', 'Berazategui', 'georef'),
  ('Puerto Trinidad', '420', 'Berazategui', 'georef'),
  ('Alejandro Petión', '470', 'Cañuelas', 'georef'),
  ('Barrio El Taladro', '470', 'Cañuelas', 'georef'),
  ('Cañuelas', '470', 'Cañuelas', 'georef'),
  ('Gobernador Udaondo', '470', 'Cañuelas', 'georef'),
  ('Santa Rosa', '470', 'Cañuelas', 'georef'),
  ('Uribelarrea', '470', 'Cañuelas', 'georef'),
  ('Vicente Casares', '470', 'Cañuelas', 'georef'),
  ('Barrio Belgrano', '470', 'Cañuelas', 'georef'),
  ('Máximo Paz', '470', 'Cañuelas', 'georef'),
  ('Cuartel XV', '470', 'Cañuelas', 'georef'),
  ('El Deslinde', '470', 'Cañuelas', 'georef'),
  ('La Leonor', '470', 'Cañuelas', 'georef'),
  ('La Noria', '470', 'Cañuelas', 'georef'),
  ('La Tapie', '470', 'Cañuelas', 'georef'),
  ('Las Palmitas', '470', 'Cañuelas', 'georef'),
  ('Los Álamos', '470', 'Cañuelas', 'georef'),
  ('San Antonio', '470', 'Cañuelas', 'georef'),
  ('Aldo Bonzi', '430', 'La Matanza', 'georef'),
  ('Ciudad Evita', '450', 'La Matanza', 'georef'),
  ('González Catán', '460', 'La Matanza', 'georef'),
  ('Gregorio de Laferrere', '450', 'La Matanza', 'georef'),
  ('Isidro Casanova', '440', 'La Matanza', 'georef'),
  ('La Tablada', '430', 'La Matanza', 'georef'),
  ('Lomas del Mirador', '430', 'La Matanza', 'georef'),
  ('Rafael Castillo', '440', 'La Matanza', 'georef'),
  ('Ramos Mejía', '430', 'La Matanza', 'georef'),
  ('San Justo', '440', 'La Matanza', 'georef'),
  ('Tapiales', '430', 'La Matanza', 'georef'),
  ('20 de Junio', '460', 'La Matanza', 'georef'),
  ('Villa Eduardo Madero', '430', 'La Matanza', 'georef'),
  ('Villa Luzuriaga', '440', 'La Matanza', 'georef'),
  ('Virrey del Pino', '470', 'La Matanza', 'georef'),
  ('José Clemente Paz', '350', 'José Clemente Paz', 'partido'),
  ('Hurlinham', '360', 'Hurlinham', 'partido'),
  ('3 de Febrero', '370', '3 de Febrero', 'partido'),
  ('San Martín', '370', 'San Martín', 'partido'),
  ('Beriso', '380', 'Beriso', 'partido'),
  ('Villa Madero', '430', 'La Matanza', 'alias'),
  ('Madero', '430', 'La Matanza', 'alias'),
  ('Villa Celina', '430', 'La Matanza', 'alias'),
  ('Lomas Mirador', '430', 'La Matanza', 'alias'),
  ('Ramos', '430', 'La Matanza', 'alias'),
  ('Luzuriaga', '440', 'La Matanza', 'alias'),
  ('Casanova', '440', 'La Matanza', 'alias'),
  ('Laferrere', '450', 'La Matanza', 'alias'),
  ('La Ferrere', '450', 'La Matanza', 'alias'),
  ('Gregorio de la Ferrere', '450', 'La Matanza', 'alias'),
  ('Catán', '460', 'La Matanza', 'alias'),
  ('Veinte de Junio', '460', 'La Matanza', 'alias'),
  ('Spegazzini', '390', 'Ezeiza', 'alias'),
  ('Espegazzini', '390', 'Ezeiza', 'alias'),
  ('Montegrande', '390', 'Esteban Echeverría', 'alias'),
  ('San Andrés', '370', 'General San Martín', 'alias'),
  ('Ballester', '370', 'General San Martín', 'alias'),
  ('José León Suárez', '370', 'General San Martín', 'alias'),
  ('León Suárez', '370', 'General San Martín', 'alias'),
  ('Villa Concepción', '370', 'General San Martín', 'alias'),
  ('Palomar', '360', 'Morón', 'alias'),
  ('Villa Tesei', '360', 'Hurlingham', 'alias'),
  ('William Morris', '360', 'Hurlingham', 'alias'),
  ('Boulogne', '310', 'San Isidro', 'alias'),
  ('Pacheco', '310', 'Tigre', 'alias'),
  ('Don Torcuato', '310', 'Tigre', 'alias'),
  ('Maschwitz', '320', 'Escobar', 'alias'),
  ('Nogués', '350', 'Malvinas Argentinas', 'alias'),
  ('Pablo Nogués', '350', 'Malvinas Argentinas', 'alias'),
  ('Derqui', '330', 'Pilar', 'alias'),
  ('Piñeiro', '400', 'Avellaneda', 'alias'),
  ('Dominico', '400', 'Avellaneda', 'alias'),
  ('Crucecita', '400', 'Avellaneda', 'alias'),
  ('Fiorito', '400', 'Lomas de Zamora', 'alias'),
  ('Marmol', '410', 'Almirante Brown', 'alias'),
  ('Calzada', '410', 'Almirante Brown', 'alias'),
  ('Varela', '410', 'Florencio Varela', 'alias'),
  ('Hudson', '420', 'Berazategui', 'alias'),
  ('Gonnet', '380', 'La Plata', 'alias'),
  ('Melchor Romero', '380', 'La Plata', 'alias'),
  ('Agronomía', '300', 'CABA', 'caba'),
  ('Almagro', '300', 'CABA', 'caba'),
  ('Balvanera', '300', 'CABA', 'caba'),
  ('Barracas', '300', 'CABA', 'caba'),
  ('Belgrano', '300', 'CABA', 'caba'),
  ('Boedo', '300', 'CABA', 'caba'),
  ('Caballito', '300', 'CABA', 'caba'),
  ('Chacarita', '300', 'CABA', 'caba'),
  ('Coghlan', '300', 'CABA', 'caba'),
  ('Colegiales', '300', 'CABA', 'caba'),
  ('Constitución', '300', 'CABA', 'caba'),
  ('Flores', '300', 'CABA', 'caba'),
  ('Floresta', '300', 'CABA', 'caba'),
  ('La Boca', '300', 'CABA', 'caba'),
  ('La Paternal', '300', 'CABA', 'caba'),
  ('Paternal', '300', 'CABA', 'caba'),
  ('Liniers', '300', 'CABA', 'caba'),
  ('Mataderos', '300', 'CABA', 'caba'),
  ('Monte Castro', '300', 'CABA', 'caba'),
  ('Monserrat', '300', 'CABA', 'caba'),
  ('Montserrat', '300', 'CABA', 'caba'),
  ('Nueva Pompeya', '300', 'CABA', 'caba'),
  ('Pompeya', '300', 'CABA', 'caba'),
  ('Núñez', '300', 'CABA', 'caba'),
  ('Palermo', '300', 'CABA', 'caba'),
  ('Parque Avellaneda', '300', 'CABA', 'caba'),
  ('Parque Chacabuco', '300', 'CABA', 'caba'),
  ('Parque Chas', '300', 'CABA', 'caba'),
  ('Parque Patricios', '300', 'CABA', 'caba'),
  ('Puerto Madero', '300', 'CABA', 'caba'),
  ('Recoleta', '300', 'CABA', 'caba'),
  ('Retiro', '300', 'CABA', 'caba'),
  ('Saavedra', '300', 'CABA', 'caba'),
  ('San Cristóbal', '300', 'CABA', 'caba'),
  ('San Telmo', '300', 'CABA', 'caba'),
  ('Vélez Sarsfield', '300', 'CABA', 'caba'),
  ('Versalles', '300', 'CABA', 'caba'),
  ('Villa Crespo', '300', 'CABA', 'caba'),
  ('Villa del Parque', '300', 'CABA', 'caba'),
  ('Villa Devoto', '300', 'CABA', 'caba'),
  ('Villa General Mitre', '300', 'CABA', 'caba'),
  ('Villa Lugano', '300', 'CABA', 'caba'),
  ('Lugano', '300', 'CABA', 'caba'),
  ('Villa Luro', '300', 'CABA', 'caba'),
  ('Villa Ortúzar', '300', 'CABA', 'caba'),
  ('Villa Pueyrredón', '300', 'CABA', 'caba'),
  ('Villa Real', '300', 'CABA', 'caba'),
  ('Villa Riachuelo', '300', 'CABA', 'caba'),
  ('Villa Santa Rita', '300', 'CABA', 'caba'),
  ('Villa Soldati', '300', 'CABA', 'caba'),
  ('Villa Urquiza', '300', 'CABA', 'caba'),
  ('CABA', '300', 'CABA', 'caba'),
  ('Capital Federal', '300', 'CABA', 'caba'),
  ('Capital', '300', 'CABA', 'caba'),
  ('Ciudad Autónoma de Buenos Aires', '300', 'CABA', 'caba'),
  ('Ciudad de Buenos Aires', '300', 'CABA', 'caba')
), normal as (
  select public.femway_normalizar(nombre) as clave, nombre, zona, partido, origen
    from crudo
   where public.femway_normalizar(nombre) not in (
     'CUARTEL V', 'CUARTEL II', 'CUARTEL XV', 'SANTA ROSA', 'REMEDIOS DE ESCALADA', 'LA MATANZA')
), unicas as (
  select clave from normal group by clave having count(distinct zona) = 1
)
insert into public.femway_zona_lugares (clave, nombre, partido, zona, origen)
select distinct on (n.clave) n.clave, n.nombre, n.partido, n.zona, n.origen
  from normal n join unicas u using (clave)
 -- Si un nombre es a la vez partido y localidad, se queda con el partido.
 order by n.clave, (n.origen = 'partido') desc, n.nombre
on conflict (clave) do update set
  nombre = excluded.nombre, partido = excluded.partido,
  zona = excluded.zona, origen = excluded.origen;

-- ── Cubrir un texto con localidades conocidas ──
-- Se van sacando del texto las localidades conocidas, de la más larga a la más
-- corta. Sirve si no sobra nada (salvo números sueltos y letras sueltas, como
-- en "San Andres 21-C-2") y todo lo encontrado es de la misma zona: así
-- "Wilde Avellaneda" da 400, pero "San Antonio de Areco" no da la zona de
-- San Antonio (Cañuelas), porque sobra "Areco".

create or replace function public.femway_zona_cubrir(p_norm text)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_resto text := ' ' || coalesce(p_norm, '') || ' ';
  v_zonas text[] := '{}';
  r record;
begin
  if btrim(v_resto) = '' then return null; end if;
  for r in
    select clave, zona from public.femway_zona_lugares
     where position(' ' || clave || ' ' in v_resto) > 0
     order by length(clave) desc
  loop
    if position(' ' || r.clave || ' ' in v_resto) > 0 then
      v_resto := replace(v_resto, ' ' || r.clave || ' ', ' ');
      if not r.zona = any (v_zonas) then v_zonas := v_zonas || r.zona; end if;
    end if;
  end loop;
  v_resto := regexp_replace(v_resto, '\m([0-9]+|[A-Z]|DE|DEL|Y)\M', ' ', 'g');
  if btrim(v_resto) = '' and cardinality(v_zonas) = 1 then return v_zonas[1]; end if;
  return null;
end;
$fn$;
revoke all on function public.femway_zona_cubrir(text) from public, anon, authenticated;

-- ── La zona de una localidad ──
-- null si no se reconoce. La pueden pedir la planilla del vendedor (que no
-- entra con usuario de Supabase) y el admin: la tabla no tiene nada privado.

create or replace function public.femway_zona_de(p_localidad text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_ruido constant text :=
    '\m((PROVINCIA|PROV|PCIA)( DE)?|BUENOS AIRES|BS AS|BSAS|PBA|ARGENTINA|REPUBLICA ARGENTINA|PDO|PARTIDO( DE)?|GBA|CP [0-9]+)\M';
  v_norm  text := public.femway_normalizar(p_localidad);
  v_zona  text;
  v_pieza text;
  v_zonas text[] := '{}';
begin
  if v_norm = '' then return null; end if;

  -- CABA, escrita de cualquier manera. Antes de sacar "Buenos Aires" como ruido.
  if v_norm ~ '\m(CABA|C A B A|CAPITAL FEDERAL|CAP FED|CIUDAD AUTONOMA)\M'
     or v_norm in ('CAPITAL', 'CIUDAD DE BUENOS AIRES') then
    return '300';
  end if;

  v_zona := public.femway_zona_cubrir(btrim(regexp_replace(regexp_replace(v_norm, v_ruido, ' ', 'g'), ' +', ' ', 'g')));
  if v_zona is not null then return v_zona; end if;

  -- Por partes: "Caseros(CIERRA 12A14" o "Fatima/Pilar - Buenos Aires".
  -- Alcanza con que alguna parte se reconozca, si las que se reconocen coinciden.
  for v_pieza in select regexp_split_to_table(p_localidad, '[-/,;()|]') loop
    v_zona := public.femway_zona_cubrir(btrim(regexp_replace(regexp_replace(
      public.femway_normalizar(v_pieza), v_ruido, ' ', 'g'), ' +', ' ', 'g')));
    if v_zona is not null and not v_zona = any (v_zonas) then v_zonas := v_zonas || v_zona; end if;
  end loop;
  if cardinality(v_zonas) = 1 then return v_zonas[1]; end if;
  return null;
end;
$fn$;
revoke all on function public.femway_zona_de(text) from public, anon, authenticated;
grant execute on function public.femway_zona_de(text) to anon, authenticated;
