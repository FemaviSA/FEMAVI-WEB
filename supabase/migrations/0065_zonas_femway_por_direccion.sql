-- Zonas de FemWay: cuando la localidad sola no alcanza.
--
-- Hay nombres que están en dos partidos de zonas distintas (Del Viso: Pilar o
-- José C. Paz) y "La Matanza" a secas, que se reparte en cinco zonas. Para esos
-- la función femway-zona-direccion busca la calle y la altura de entrega en
-- cada partido posible (Georef) y, en La Matanza, en qué localidad caen las
-- coordenadas (OpenStreetMap). Acá está la lista de qué partidos probar.
--
-- Los nombres de partido van como los escribe Georef, que es a quien se le
-- pregunta.

create table if not exists public.femway_zona_ambiguos (
  clave    text primary key,
  partidos text[] not null
);
alter table public.femway_zona_ambiguos enable row level security;
revoke all on table public.femway_zona_ambiguos from public, anon, authenticated;

insert into public.femway_zona_ambiguos (clave, partidos) values
  ('DEL VISO',             array['Pilar', 'José C. Paz']),
  ('TORTUGUITAS',          array['Pilar', 'Malvinas Argentinas', 'José C. Paz']),
  ('SAN FRANCISCO SOLANO', array['Almirante Brown', 'Quilmes']),
  ('SOLANO',               array['Almirante Brown', 'Quilmes']),
  ('EL TROPEZON',          array['Marcos Paz', 'Florencio Varela']),
  ('REMEDIOS DE ESCALADA', array['Lanús', 'Tres de Febrero']),
  ('SANTA ROSA',           array['San Vicente', 'Cañuelas']),
  ('CUARTEL V',            array['Zárate', 'Moreno', 'Marcos Paz']),
  ('LA MATANZA',           array['La Matanza']),
  ('MATANZA',              array['La Matanza'])
on conflict (clave) do update set partidos = excluded.partidos;

-- Los partidos donde buscar la dirección; vacío si la localidad no es ambigua.
-- Se limpia igual que en femway_zona_de: "Del Viso - Bs As" es Del Viso.
create or replace function public.femway_zona_candidatos(p_localidad text)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_ruido constant text :=
    '\m((PROVINCIA|PROV|PCIA)( DE)?|BUENOS AIRES|BS AS|BSAS|PBA|ARGENTINA|REPUBLICA ARGENTINA|PDO|PARTIDO( DE)?|GBA|CP [0-9]+)\M';
  v_texto text;
  v_res   text[];
begin
  for v_texto in
    select p_localidad
    union all
    select regexp_split_to_table(p_localidad, '[-/,;()|]')
  loop
    select a.partidos into v_res
      from public.femway_zona_ambiguos a
     where a.clave = btrim(regexp_replace(regexp_replace(regexp_replace(
             public.femway_normalizar(v_texto), v_ruido, ' ', 'g'),
             '\m([0-9]+|[A-Z])\M', ' ', 'g'), ' +', ' ', 'g'));
    if v_res is not null then return v_res; end if;
  end loop;
  return '{}';
end;
$fn$;
-- Solo la usa la función del servidor, con la clave de servicio.
revoke all on function public.femway_zona_candidatos(text) from public, anon, authenticated;
