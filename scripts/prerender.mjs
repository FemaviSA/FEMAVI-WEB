// Prerenderiza a HTML estático las páginas de producto y de categoría.
//
// POR QUÉ EXISTE ESTE SCRIPT
// El sitio es un SPA de Vite: el servidor devuelve siempre el mismo index.html vacío
// (<div id="root"></div>) y el contenido lo pinta React en el navegador. El primer pase
// del crawler de Google NO ejecuta JavaScript — lo hace en una segunda pasada, más tarde
// y sin garantías. Resultado: para Google las ~200 fichas de producto estaban vacías, y
// por eso no rankeaban para búsquedas descriptivas ("desengrasante con base cítrica")
// aunque esas palabras estuvieran en la ficha.
//
// Este script corre después de `vite build` y escribe un HTML real por producto y por
// categoría, con el título, la meta description, el JSON-LD y — clave — el contenido
// visible ya escrito en el HTML. Cuando el navegador carga la página, React monta con
// createRoot() (no hydrateRoot) y reemplaza ese contenido por la app interactiva, así que
// no hay riesgo de hydration mismatch: el usuario ve exactamente lo de siempre.
//
// Requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en env (igual que generate-sitemap).
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = process.env.SITE_URL || 'https://www.femavi.com.ar';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OUT_DIR = process.env.PRERENDER_OUT || 'dist';

// Espejo de src/data/categoryConfigs.ts. Mantener en sync (el script no puede importar TS).
const CATEGORIES = [
  { slug: 'desengrasantes', name: 'Desengrasantes', subcategories: ['Desengrasantes'],
    seoTitle: 'Desengrasante Industrial en Argentina | FEMAVI',
    seoDesc: 'Desengrasantes industriales concentrados y biodegradables para metales, motores y piezas. Fórmula propia FEMAVI, venta por bidón o mayor, entrega en 48hs.',
    heroTitle: 'Desengrasante industrial concentrado, biodegradable y de alto rendimiento' },
  { slug: 'higiene-industrial', name: 'Higiene y Limpieza Industrial', subcategories: ['Higiene Industrial', 'Limpiadores', 'Detergentes'],
    seoTitle: 'Productos de Limpieza Industrial Argentina | FEMAVI',
    seoDesc: 'Productos de limpieza e higiene industrial por mayor: detergentes concentrados, limpiadores multiuso y desinfectantes. Fabricante argentino, entrega en 48hs.',
    heroTitle: 'Productos de limpieza industrial para empresas y plantas de producción' },
  { slug: 'ceras-y-pisos', name: 'Ceras y Mantenimiento de Pisos', subcategories: ['Ceras'],
    seoTitle: 'Cera Acrílica Industrial para Pisos | FEMAVI',
    seoDesc: 'Cera acrílica para pisos de alto tránsito: cerámicos, graníticos y cemento alisado. Alta duración y brillo profesional. Fabricante argentino, entrega en 48hs.',
    heroTitle: 'Cera acrílica industrial para pisos de alto tránsito' },
  { slug: 'bactericidas', name: 'Bactericidas', subcategories: ['Desinfectantes'],
    seoTitle: 'Bactericida Industrial de Amplio Espectro | FEMAVI',
    seoDesc: 'Bactericida industrial concentrado, apto para industria alimenticia, con acción residual y amplio espectro. Fabricante argentino, entrega en 48hs.',
    heroTitle: 'Bactericida industrial de amplio espectro y acción residual' },
  { slug: 'anticorrosivos', name: 'Anticorrosivos', subcategories: ['Anticorrosivos'],
    seoTitle: 'Anticorrosivo Industrial para Metales y Maquinaria | FEMAVI',
    seoDesc: 'Anticorrosivo industrial para metales, maquinaria y estructuras metálicas. Protección de larga duración, fabricante argentino, entrega en 48hs.',
    heroTitle: 'Anticorrosivo industrial para metales, maquinaria y estructuras' },
  { slug: 'lubricantes', name: 'Lubricantes', subcategories: ['Lubricantes', 'Grasas', 'Aceites y Aditivos'],
    seoTitle: 'Lubricantes Industriales Especiales | FEMAVI',
    seoDesc: 'Lubricantes industriales, grasas y aceites de fórmula propia para mantenimiento industrial. Fabricante argentino con más de 50 años, entrega en 48hs.',
    heroTitle: 'Lubricantes industriales especiales de desarrollo propio' },
];

// Espejo de src/lib/productSeo.ts — mantener en sync.
const MAX_TITLE_LEAD = 62;

function buildProductTitle(p) {
  const descriptor = (p.headline || '').trim() || `${p.subcategory ?? p.category} industrial`;
  let lead = `${p.name} — ${descriptor}`;
  if (lead.length > MAX_TITLE_LEAD) lead = `${lead.slice(0, MAX_TITLE_LEAD - 1).trimEnd()}…`;
  return `${lead} | FEMAVI`;
}

function buildProductDescription(p) {
  const tipo = p.subcategory ?? p.category;
  const base = (p.headline || '').trim() ? `${p.headline.trim()}. ${p.description}` : p.description;
  const withBrand = `${base} ${tipo} de fabricación propia FEMAVI, entrega en 48 hs.`;
  return withBrand.length > 158 ? `${withBrand.slice(0, 157).trimEnd()}…` : withBrand;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function fetchTable(table, select, filter) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}&${filter}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) {
    console.warn(`[prerender] error supabase (${table}):`, r.status, await r.text());
    return [];
  }
  return r.json();
}

/**
 * Reemplaza en el HTML base el title, la meta description, el canonical y las og tags,
 * inyecta el JSON-LD específico de la página y escribe el contenido visible dentro de #root.
 */
function renderPage(template, { title, description, canonical, jsonLd, bodyHtml, image }) {
  let html = template;

  // Los defaults de index.html llevan data-default (ver comentario allá): los reemplazamos
  // por los valores reales de esta página, manteniendo el atributo para que el componente
  // SEO los limpie cuando React monte y no queden duplicados.
  const before = html;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(
    /<meta data-default name="description" content="[\s\S]*?" \/>/,
    `<meta data-default name="description" content="${esc(description)}" />`
  );
  html = html.replace(
    /<link data-default rel="canonical" href="[\s\S]*?" \/>/,
    `<link data-default rel="canonical" href="${esc(canonical)}" />`
  );
  if (html === before) {
    throw new Error(
      'El template dist/index.html no coincide con los patrones esperados de title/description/canonical. ' +
      '¿Cambió index.html? Revisá scripts/prerender.mjs.'
    );
  }

  const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${esc(image || `${SITE_URL}/og-image.png`)}" />
    <meta property="og:locale" content="es_AR" />
    <meta property="og:site_name" content="FEMAVI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <script data-default type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>`;
  html = html.replace('</head>', ogTags);

  html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  return html;
}

// Estilos inline para el HTML prerenderizado. React reemplaza todo esto ni bien monta,
// pero durante ese instante (y en conexiones lentas puede ser un segundo o más) es lo que
// ve el usuario: sin esto vería texto crudo sin formato. El contenido es idéntico al que
// termina renderizando React — no se oculta nada al usuario ni se le muestra algo distinto
// a lo que ve Google, así que no hay riesgo de cloaking.
const S = {
  wrap: 'max-width:1100px;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1a2b3c',
  crumb: 'font-size:13px;color:#5a6f80;margin-bottom:20px',
  crumbLink: 'color:#5a6f80;text-decoration:none',
  eyebrow: 'display:block;font-size:12px;font-weight:700;color:#0067ac;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px',
  h1: 'font-size:40px;font-weight:800;color:#004370;letter-spacing:-.02em;line-height:1.1;margin:0 0 12px',
  lead: 'font-size:18px;font-weight:400;color:#5a6f80;font-style:italic;line-height:1.5;margin:0 0 24px',
  h2: 'font-size:14px;font-weight:700;color:#8899a8;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 8px',
  p: 'font-size:16px;line-height:1.8;margin:0 0 16px',
  ul: 'padding-left:20px;line-height:1.9;color:#5a6f80',
  dl: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:0 0 24px;padding:0',
  spec: 'padding:12px 16px;background:#fff;border:1px solid #e2e8ee;border-radius:8px',
  dt: 'font-size:11px;font-weight:700;color:#8899a8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px',
  dd: 'font-size:14px;font-weight:500;margin:0',
  cta: 'display:inline-block;padding:14px 28px;background:#0067ac;color:#fff;font-weight:700;border-radius:10px;text-decoration:none;margin:8px 0 32px',
  link: 'color:#0067ac;text-decoration:none;font-weight:600',
};

function productBody(p, related, category) {
  const tipo = p.subcategory ?? p.category;
  const spec = (label, value) =>
    `<div style="${S.spec}"><dt style="${S.dt}">${label}</dt><dd style="${S.dd}">${esc(value)}</dd></div>`;
  const specs = [
    p.dilution && spec('Dilución', p.dilution),
    p.ph && spec('pH', p.ph),
    p.industries?.length && spec('Industrias', p.industries.join(', ')),
    p.presentations?.length && spec('Presentaciones', p.presentations.join(', ')),
  ].filter(Boolean).join('');

  const relatedHtml = related.length
    ? `<section><h2 style="${S.h2}">Productos relacionados</h2><ul style="${S.ul}">${related
        .map(r => `<li><a style="${S.link}" href="/catalogo/${esc(r.slug)}">${esc(r.name)}${r.headline ? ` — ${esc(r.headline)}` : ''}</a></li>`)
        .join('')}</ul></section>`
    : '';

  const categoryCrumb = category
    ? `<a style="${S.crumbLink}" href="/catalogo/categoria/${esc(category.slug)}">${esc(category.name)}</a>`
    : `<span>${esc(tipo)}</span>`;

  return `<div style="${S.wrap}">
<nav aria-label="breadcrumb" style="${S.crumb}"><a style="${S.crumbLink}" href="/">Inicio</a> › <a style="${S.crumbLink}" href="/catalogo">Catálogo</a> › ${categoryCrumb}</nav>
<article>
  <span style="${S.eyebrow}">${esc(tipo)}</span>
  <h1 style="${S.h1}">${esc(p.name)}</h1>
  ${p.headline ? `<h2 style="${S.lead}">${esc(p.headline)}</h2>` : ''}
  ${p.benefits?.length ? `<ul style="${S.ul}">${p.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
  <h2 style="${S.h2}">Descripción</h2>
  <p style="${S.p}">${esc(p.description)}</p>
  ${p.story ? `<h2 style="${S.h2}">La historia detrás del producto</h2><p style="${S.p}">${esc(p.story)}</p>` : ''}
  ${specs ? `<h2 style="${S.h2}">Datos técnicos</h2><dl style="${S.dl}">${specs}</dl>` : ''}
  <a style="${S.cta}" href="/cotizar">Pedir cotización de ${esc(p.name)}</a>
  ${relatedHtml}
</article>
</div>`;
}

function categoryBody(cat, products) {
  return `<div style="${S.wrap}">
<nav aria-label="breadcrumb" style="${S.crumb}"><a style="${S.crumbLink}" href="/">Inicio</a> › <a style="${S.crumbLink}" href="/catalogo">Catálogo</a> › <span>${esc(cat.name)}</span></nav>
<article>
  <h1 style="${S.h1}">${esc(cat.heroTitle)}</h1>
  <p style="${S.p}">${esc(cat.seoDesc)}</p>
  <h2 style="${S.h2}">${products.length} productos en ${esc(cat.name)}</h2>
  <ul style="${S.ul}">${products
    .map(p => `<li><a style="${S.link}" href="/catalogo/${esc(p.slug)}">${esc(p.name)}${p.headline ? ` — ${esc(p.headline)}` : ''}</a></li>`)
    .join('')}</ul>
  <a style="${S.cta}" href="/cotizar">Solicitar cotización</a>
</article>
</div>`;
}

/**
 * Escribe la página como archivo .html plano (ej. dist/catalogo/citrif.html), NO como
 * dist/catalogo/citrif/index.html.
 *
 * Por qué: la variante con directorio solo se resuelve si la URL trae barra final
 * (/catalogo/citrif/). Sin la barra, el server no encuentra el índice del directorio y la
 * request cae al fallback del SPA — o sea, el prerender no serviría para nada justo en la
 * URL que usa todo el mundo. Con archivo plano + "cleanUrls": true en vercel.json,
 * /catalogo/citrif sirve catalogo/citrif.html de forma explícita y determinística.
 */
function writePage(routePath, html) {
  const parts = routePath.split('/');
  const file = parts.pop();
  const dir = join(OUT_DIR, ...parts);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${file}.html`), html, 'utf8');
}

// ─── main ───
const templatePath = join(OUT_DIR, 'index.html');
if (!existsSync(templatePath)) {
  console.error(`[prerender] no existe ${templatePath} — corré "vite build" antes.`);
  process.exit(1);
}
const template = readFileSync(templatePath, 'utf8');

const products = await fetchTable(
  'products',
  'slug,name,category,subcategory,headline,description,story,industries,benefits,presentations,dilution,ph,image_url',
  'is_active=eq.true&order=display_order.asc'
);

if (products.length === 0) {
  console.warn('[prerender] sin productos (¿faltan env vars de Supabase?) — no se prerenderiza nada.');
  process.exit(0);
}

let count = 0;

for (const p of products) {
  const category = CATEGORIES.find(c => p.subcategory && c.subcategories.includes(p.subcategory));
  const canonical = `${SITE_URL}/catalogo/${p.slug}`;
  // Mismo criterio que ProductPage.tsx: primero misma subcategoría (relación fuerte,
  // ej. otro desengrasante), y recién después misma categoría amplia como relleno.
  const others = products.filter(o => o.slug !== p.slug);
  const sameSubcategory = p.subcategory ? others.filter(o => o.subcategory === p.subcategory) : [];
  const sameCategory = others.filter(o => o.category === p.category && !sameSubcategory.includes(o));
  const related = [...sameSubcategory, ...sameCategory].slice(0, 3);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${canonical}#product`,
      name: p.name,
      description: p.headline ? `${p.headline}. ${p.description}` : p.description,
      image: p.image_url ? [p.image_url] : undefined,
      sku: p.slug,
      category: p.subcategory ?? p.category,
      brand: { '@type': 'Brand', name: 'FEMAVI' },
      manufacturer: { '@id': `${SITE_URL}/#organization` },
      additionalProperty: [
        p.dilution && { '@type': 'PropertyValue', name: 'Dilución', value: p.dilution },
        p.ph && { '@type': 'PropertyValue', name: 'pH', value: p.ph },
        p.presentations?.length && { '@type': 'PropertyValue', name: 'Presentaciones', value: p.presentations.join(', ') },
      ].filter(Boolean),
      offers: {
        '@type': 'Offer', priceCurrency: 'ARS', availability: 'https://schema.org/InStock',
        url: canonical, seller: { '@id': `${SITE_URL}/#organization` },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE_URL}/catalogo` },
        ...(category ? [{ '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/catalogo/categoria/${category.slug}` }] : []),
        { '@type': 'ListItem', position: category ? 4 : 3, name: p.name, item: canonical },
      ],
    },
  ];

  writePage(`catalogo/${p.slug}`, renderPage(template, {
    title: buildProductTitle(p),
    description: buildProductDescription(p),
    canonical,
    image: p.image_url,
    jsonLd,
    bodyHtml: productBody(p, related, category),
  }));
  count++;
}

for (const cat of CATEGORIES) {
  const catProducts = products.filter(p => p.subcategory && cat.subcategories.includes(p.subcategory));
  const canonical = `${SITE_URL}/catalogo/categoria/${cat.slug}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: cat.seoTitle,
      description: cat.seoDesc,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE_URL}/catalogo` },
          { '@type': 'ListItem', position: 3, name: cat.name, item: canonical },
        ],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: cat.name,
      numberOfItems: catProducts.length,
      itemListElement: catProducts.slice(0, 24).map((p, i) => ({
        '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/catalogo/${p.slug}`, name: p.name,
      })),
    },
  ];

  writePage(`catalogo/categoria/${cat.slug}`, renderPage(template, {
    title: cat.seoTitle,
    description: cat.seoDesc,
    canonical,
    jsonLd,
    bodyHtml: categoryBody(cat, catProducts),
  }));
  count++;
}

console.log(`[prerender] ✓ ${count} páginas HTML estáticas (${products.length} productos + ${CATEGORIES.length} categorías) → ${OUT_DIR}/`);
