-- Tabla de seguimiento de temas de blog para la automatización semanal (ver sección 7
-- de la estrategia SEO). Cada fila es un tema pendiente de escribir; la Edge Function
-- weekly-blog-post toma el de menor id con covered = false, lo redacta y lo marca.

create table if not exists public.content_topics (
  id bigint generated always as identity primary key,
  category text not null,
  keyword text not null,
  content_type text not null check (content_type in ('educativo', 'caso_uso', 'comparativa')),
  covered boolean not null default false,
  article_id bigint references public.articles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_content_topics_pending on public.content_topics(id) where not covered;

alter table public.content_topics enable row level security;

drop policy if exists "authenticated can do everything" on public.content_topics;
create policy "authenticated can do everything" on public.content_topics for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Nota: la Edge Function usa la service role key (bypassa RLS), así que no necesita
-- una policy pública. Solo se deja acceso de administración para uso desde el panel.

insert into public.content_topics (category, keyword, content_type) values
  ('desengrasantes', 'desengrasante industrial Argentina y Buenos Aires: qué considerar antes de comprar', 'educativo'),
  ('desengrasantes', 'cómo elegimos el desengrasante correcto para una flota de 200 colectivos', 'caso_uso'),
  ('desengrasantes', 'desengrasante biodegradable vs. desengrasante tradicional: diferencias reales', 'comparativa'),
  ('desengrasantes', 'desengrasante para metales, piezas y motores: guía de dilución por superficie', 'educativo'),
  ('desengrasantes', 'desengrasante concentrado por bidón vs. por mayor: cuándo conviene cada presentación', 'comparativa'),
  ('higiene-industrial', 'productos de higiene industrial por mayor: qué mirar antes de elegir proveedor', 'educativo'),
  ('higiene-industrial', 'cómo una empresa de limpieza redujo su costo por m² con productos concentrados', 'caso_uso'),
  ('higiene-industrial', 'desinfectante industrial concentrado vs. listo para usar: rendimiento real', 'comparativa'),
  ('higiene-industrial', 'qué preguntar a un proveedor de productos de limpieza para empresas', 'educativo'),
  ('ceras-y-pisos', 'cera para pisos de alto tránsito: cómo elegir según el tipo de superficie', 'educativo'),
  ('ceras-y-pisos', 'cera acrílica para cerámicos, graníticos y cemento alisado: guía de aplicación', 'educativo'),
  ('ceras-y-pisos', 'diferencia entre cera acrílica y sellador de pisos', 'comparativa'),
  ('ceras-y-pisos', 'cómo un edificio corporativo bajó su frecuencia de mantenimiento de pisos', 'caso_uso'),
  ('bactericidas', 'bactericida para eliminar malos olores: por qué enmascarar no alcanza', 'educativo'),
  ('bactericidas', 'desinfectante bactericida concentrado: cómo calcular la dilución correcta', 'educativo'),
  ('bactericidas', 'bactericida de amplio espectro vs. desinfectante común: qué elegir según el rubro', 'comparativa'),
  ('anticorrosivos', 'protección anticorrosiva para metales: guía para almacenaje de piezas mecanizadas', 'educativo'),
  ('anticorrosivos', 'anticorrosivo para maquinaria y estructuras metálicas: cómo prevenir la corrosión', 'educativo'),
  ('anticorrosivos', 'anticorrosivo de película seca vs. grasa anticorrosiva: cuándo usar cada uno', 'comparativa'),
  ('anticorrosivos', 'cómo un taller metalúrgico eliminó la oxidación en su stock de piezas', 'caso_uso'),
  ('lubricantes', 'lubricante para mantenimiento industrial: cómo armar un plan de lubricación preventiva', 'educativo'),
  ('lubricantes', 'grasa lubricante industrial por mayor: qué considerar al comprar en volumen', 'educativo'),
  ('lubricantes', 'lubricante multiuso vs. grasa de alta temperatura: cuál corresponde a cada mecanismo', 'comparativa'),
  ('transporte', 'limpieza y mantenimiento de flotas de transporte: protocolo completo', 'educativo'),
  ('transporte', 'desengrasante para camiones y flotas: cómo tratar el tren delantero', 'educativo'),
  ('transporte', 'cómo una línea de colectivos organizó su protocolo de limpieza con FEMAVI', 'caso_uso'),
  ('gastronomia', 'desengrasante para cocinas industriales: cómo elegir sin dañar superficies de acero', 'educativo'),
  ('gastronomia', 'bactericida para industria alimentaria: qué exige la normativa de higiene', 'educativo'),
  ('gastronomia', 'desengrasante para campanas y cocinas vs. limpiador multiuso: diferencias', 'comparativa'),
  ('marca', 'fabricante de productos químicos industriales en Argentina: ventajas de la fórmula propia', 'educativo'),
  ('marca', 'productos químicos industriales a medida: cómo funciona el desarrollo de fórmula propia en FEMAVI', 'caso_uso')
on conflict do nothing;
