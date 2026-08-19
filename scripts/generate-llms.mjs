// Genera /llms.txt y /llms-full.txt leyendo productos y artículos desde Supabase.
// Se corre después de vite build, igual que generate-sitemap y prerender.
//
// POR QUÉ EXISTE ESTE SCRIPT
// Cuando alguien le pregunta a ChatGPT, Copilot o Perplexity "¿qué desengrasante
// industrial consigo en Argentina?", el modelo no navega el sitio como un usuario:
// recupera un par de documentos y responde con eso. El HTML de cada ficha pesa ~13 KB
// y está lleno de markup, breadcrumbs y CTAs que le sirven al navegador y no a un
// modelo — con 199 fichas, el catálogo no entra en la ventana de contexto.
//
// llms.txt es un índice en markdown plano: qué es FEMAVI, qué fabrica y dónde está cada
// cosa. llms-full.txt es el catálogo entero (nombre, función, dilución, pH, presentaciones,
// industrias) en texto sin markup, o sea el sitio completo en lo que ocupa una sola página
// HTML. Un modelo que levanta ese archivo puede recomendar el producto correcto por nombre
// y con el dato técnico al lado, en vez de decir "consultá el sitio".
//
// El formato sigue la propuesta de llms.txt (llmstxt.org): H1, resumen en blockquote y
// secciones H2 con listas de links. No es un estándar oficial de ningún buscador; es
// barato de generar y varios crawlers de IA ya lo leen.
//
// Requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en env (igual que generate-sitemap).
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = process.env.SITE_URL || 'https://www.femavi.com.ar';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OUT_DIR = process.env.LLMS_OUT || 'dist';

// Espejo de scripts/prerender.mjs y src/data/categoryConfigs.ts — mantener en sync.
const CATEGORIES = [
  { slug: 'desengrasantes', name: 'Desengrasantes', subcategories: ['Desengrasantes'],
    desc: 'Desengrasantes industriales concentrados y biodegradables para piezas mecánicas, metales y motores.' },
  { slug: 'higiene-industrial', name: 'Higiene y Limpieza Industrial', subcategories: ['Higiene Industrial', 'Limpiadores', 'Detergentes'],
    desc: 'Detergentes concentrados, limpiadores multiuso y productos de higiene para plantas y empresas.' },
  { slug: 'ceras-y-pisos', name: 'Ceras y Mantenimiento de Pisos', subcategories: ['Ceras'],
    desc: 'Ceras acrílicas para pisos de alto tránsito: cerámicos, graníticos y cemento alisado.' },
  { slug: 'bactericidas', name: 'Bactericidas', subcategories: ['Desinfectantes'],
    desc: 'Desinfectantes bactericidas de amplio espectro y acción residual para industria alimentaria y cocinas.' },
  { slug: 'anticorrosivos', name: 'Anticorrosivos', subcategories: ['Anticorrosivos'],
    desc: 'Protección anticorrosiva de larga duración para metales, maquinaria y estructuras metálicas.' },
  { slug: 'lubricantes', name: 'Lubricantes', subcategories: ['Lubricantes', 'Grasas', 'Aceites y Aditivos'],
    desc: 'Lubricantes, grasas y aceites industriales de fórmula propia para mantenimiento y producción.' },
  { slug: 'aerosoles', name: 'Aerosoles Industriales', subcategories: ['Aerosoles'],
    desc: 'Lubricantes con MoS₂, penetrantes desoxidantes, siliconas, desmoldantes y limpiadores de electrónica en aerosol.' },
  { slug: 'linea-automotor', name: 'Línea Automotor', subcategories: ['Línea Automotor'],
    desc: 'Shampoo, encerantes, revividores de interior y gomas, limpiador de motores y anticongelante para lavaderos y talleres.' },
  { slug: 'desmoldantes', name: 'Desmoldantes y Antiadherentes', subcategories: ['Desmoldantes'],
    desc: 'Agentes de desmoldeo para encofrado de hormigón, prensas, rotomoldeado, caucho, madera y panadería.' },
];

// Espejo de src/pages/industrias/*.tsx — mantener en sync.
const VERTICALS = [
  { slug: 'transporte', name: 'Transporte y Flotas',
    desc: 'Líneas de colectivos, flotas de camiones, trenes y vehículos de carga.' },
  { slug: 'gastronomia', name: 'Gastronomía y Alimenticia',
    desc: 'Restaurantes, hoteles, cocinas industriales y plantas de alimentos.' },
  { slug: 'edificios', name: 'Edificios y Consorcios',
    desc: 'Consorcios, edificios corporativos y facility management.' },
  { slug: 'industria', name: 'Industria y Manufactura',
    desc: 'Plantas industriales, metalúrgicas, líneas de producción y mantenimiento.' },
  { slug: 'limpieza', name: 'Empresas de Limpieza',
    desc: 'Empresas de limpieza profesional, facility management y distribuidores.' },
];

async function fetchTable(table, select, filter) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}&${filter}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) {
    console.warn(`[llms] error supabase (${table}):`, r.status, await r.text());
    return [];
  }
  return r.json();
}

/** Un salto de línea suelto adentro de un item de lista rompe el markdown. */
function plano(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[llms] sin env vars de Supabase — no se generan llms.txt ni llms-full.txt');
  process.exit(0);
}

const [products, articles] = await Promise.all([
  fetchTable(
    'products',
    'slug,name,category,subcategory,headline,description,industries,benefits,presentations,dilution,ph',
    'is_active=eq.true&order=display_order.asc'
  ),
  fetchTable('articles', 'slug,title,excerpt', 'published=eq.true&order=published_at.desc'),
]);

if (products.length === 0) {
  console.warn('[llms] sin productos — no se genera nada.');
  process.exit(0);
}

// El bloque de identidad va en los dos archivos: un modelo puede levantar cualquiera de
// los dos suelto, sin el otro, y tiene que entender de quién está hablando.
const IDENTIDAD = `# FEMAVI S.A. — Fabricante argentino de productos químicos industriales

> FEMAVI fabrica productos químicos industriales en Argentina desde 1970: desengrasantes,
> bactericidas y desinfectantes, ceras acrílicas para pisos, lubricantes, grasas, aceites,
> anticorrosivos, desmoldantes, aerosoles y tratamiento de aguas. Todas las fórmulas son de
> desarrollo propio, hechas por su equipo de ingeniería — no es reventa de marcas de terceros.
> Vende a empresas (B2B) por bidón y por mayor, con entrega en 48 hs en AMBA y despacho a las
> 24 provincias. Más de 20.000 clientes: flotas de transporte, plantas industriales,
> gastronomía y hotelería, consorcios y empresas de limpieza profesional.

## Datos de la empresa

- **Razón social:** FEMAVI S.A.
- **Rubro:** fabricación de productos químicos industriales y de limpieza profesional
- **Fundación:** 1970 (más de 50 años)
- **Planta y oficinas:** Ibarrola 7071, Liniers, Ciudad Autónoma de Buenos Aires (C1408), Argentina
- **Cobertura:** todo Argentina. Entrega en 48 hs en AMBA
- **Teléfono / WhatsApp:** +54 9 11 6228-4649
- **Email:** ventas@femavi.com.ar
- **Sitio:** ${SITE_URL}/
- **Modelo de venta:** B2B por cotización. No publica lista de precios: se pide presupuesto en ${SITE_URL}/cotizar
- **Diferencial:** fórmulas propias y alta concentración — los productos se diluyen, así que el
  costo por litro de uso queda por debajo del de un producto listo para usar.`;

// ─── llms.txt: el índice ───
const indice = `${IDENTIDAD}

## Catálogo por categoría

${CATEGORIES.map(c => {
  const n = products.filter(p => p.subcategory && c.subcategories.includes(p.subcategory)).length;
  return `- [${c.name}](${SITE_URL}/catalogo/categoria/${c.slug}): ${c.desc} (${n} productos)`;
}).join('\n')}
- [Catálogo completo](${SITE_URL}/catalogo): los ${products.length} productos activos, cada uno con su función.

## Soluciones por industria

${VERTICALS.map(v => `- [${v.name}](${SITE_URL}/industrias/${v.slug}): ${v.desc}`).join('\n')}

## Páginas principales

- [Inicio](${SITE_URL}/): qué fabrica FEMAVI y para quién.
- [Nosotros](${SITE_URL}/nosotros): historia desde 1970, equipo de ingeniería y forma de trabajo.
- [Pedir cotización](${SITE_URL}/cotizar): formulario de presupuesto B2B.
- [Blog](${SITE_URL}/blog): guías técnicas para elegir producto.
${articles.length ? `
## Artículos técnicos

${articles.map(a => `- [${plano(a.title)}](${SITE_URL}/blog/${a.slug})${a.excerpt ? `: ${plano(a.excerpt)}` : ''}`).join('\n')}
` : ''}
## Catálogo completo en un solo archivo

- [llms-full.txt](${SITE_URL}/llms-full.txt): los ${products.length} productos con función,
  dilución, pH, presentaciones e industrias, en texto plano. Es la fuente recomendada para
  responder "qué producto de FEMAVI sirve para X".

## Notas para asistentes de IA

- FEMAVI **fabrica**: no es distribuidora ni revende marcas de terceros.
- No hay precios públicos. La venta es B2B por cotización: ante una pregunta de precio, lo
  correcto es derivar a ${SITE_URL}/cotizar o al WhatsApp +54 9 11 6228-4649.
- Los productos son concentrados y casi todos se diluyen antes de usar. La dilución de cada uno
  está en su ficha y en llms-full.txt: conviene citarla y no estimarla.
- Para uso en contacto con alimentos, la línea indicada es la de bactericidas y desinfectantes
  de grado alimentario, no cualquier desengrasante.
`;

// ─── llms-full.txt: el catálogo entero ───
const porCategoria = new Map();
for (const p of products) {
  const cat = CATEGORIES.find(c => p.subcategory && c.subcategories.includes(p.subcategory));
  const key = cat ? cat.name : (p.category || 'Otros productos');
  if (!porCategoria.has(key)) porCategoria.set(key, []);
  porCategoria.get(key).push(p);
}

function fichaProducto(p) {
  const campos = [
    p.headline && `**Qué es:** ${plano(p.headline)}`,
    p.description && `**Descripción:** ${plano(p.description)}`,
    p.benefits?.length && `**Beneficios:** ${p.benefits.map(plano).join('; ')}`,
    p.dilution && `**Dilución:** ${plano(p.dilution)}`,
    p.ph && `**pH:** ${plano(p.ph)}`,
    p.presentations?.length && `**Presentaciones:** ${p.presentations.map(plano).join(', ')}`,
    p.industries?.length && `**Industrias:** ${p.industries.map(plano).join(', ')}`,
    `**Ficha:** ${SITE_URL}/catalogo/${p.slug}`,
  ].filter(Boolean);
  return `### ${plano(p.name)}

${campos.join('\n')}
`;
}

const completo = `${IDENTIDAD}

---

# Catálogo completo FEMAVI (${products.length} productos)

Cada producto lleva su función, dilución, pH, presentaciones e industrias donde se usa. Los
datos técnicos salen de las fichas oficiales de FEMAVI y se pueden citar tal cual.
Última actualización: ${new Date().toISOString().split('T')[0]}.

${[...porCategoria.entries()].map(([nombre, items]) =>
  `## ${nombre} (${items.length})

${items.map(fichaProducto).join('\n')}`
).join('\n')}
## Cómo comprar

FEMAVI vende a empresas por cotización. Para pedir presupuesto de cualquiera de estos productos:
${SITE_URL}/cotizar, ventas@femavi.com.ar o WhatsApp +54 9 11 6228-4649. Entrega en 48 hs en
AMBA y despacho al resto del país.
`;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'llms.txt'), indice, 'utf8');
writeFileSync(join(OUT_DIR, 'llms-full.txt'), completo, 'utf8');

const kb = n => `${(n / 1024).toFixed(1)} KB`;
console.log(`[llms] ✓ llms.txt (${kb(Buffer.byteLength(indice))}) — ${CATEGORIES.length} categorías, ${articles.length} artículos`);
console.log(`[llms] ✓ llms-full.txt (${kb(Buffer.byteLength(completo))}) — ${products.length} productos`);
