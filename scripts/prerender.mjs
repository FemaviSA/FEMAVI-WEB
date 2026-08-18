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
    seoTitle: 'Desengrasante Industrial para Piezas y Metales — Argentina | FEMAVI',
    seoDesc: 'Desengrasantes industriales concentrados y biodegradables para limpieza de piezas mecánicas, metales y motores. Fórmula propia FEMAVI, venta por bidón o mayor, entrega en 48hs.',
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
    seoTitle: 'Desinfectante y Bactericida Industrial — Industria Alimentaria | FEMAVI',
    seoDesc: 'Desinfectante bactericida industrial concentrado para industria alimentaria, cocinas y plantas. Amplio espectro y acción residual. Fabricante argentino, entrega en 48hs.',
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

// Espejo de los configs de src/pages/industrias/*.tsx (solo lo que importa para SEO;
// los productos se traen de Supabase por industria, así que no hay que duplicarlos).
// Mantener en sync con esos archivos.
const VERTICALS = [
  { slug: 'transporte', name: 'Transporte y Flotas', industryKeywords: ['transporte'],
    heroTitle: 'Productos de limpieza y mantenimiento para flotas de transporte',
    heroDesc: 'Desengrasantes industriales, sanitizantes, ceras y lubricantes desarrollados para líneas de colectivos, flotas de camiones, trenes y vehículos de carga. Entrega en base. Rendimiento comprobado por las empresas de transporte más grandes del AMBA.',
    seoTitle: 'Productos de limpieza para transporte y flotas | FEMAVI',
    seoDesc: 'Desengrasantes, sanitizantes y lubricantes para flotas de colectivos, camiones y transporte de pasajeros. Entrega en 48hs en AMBA. +50 años fabricando en Argentina.' },
  { slug: 'gastronomia', name: 'Gastronomía y Alimenticia', industryKeywords: ['gastronomía', 'hotelería', 'alimenticia'],
    heroTitle: 'Productos de limpieza para gastronomía, restaurantes y cocinas industriales',
    heroDesc: 'Bactericidas de grado alimentario, desengrasantes alcalinos para cocinas, desincrustantes y detergentes lavavajillas para restaurantes, hoteles y plantas de alimentos.',
    seoTitle: 'Productos de limpieza para gastronomía y cocinas industriales | FEMAVI',
    seoDesc: 'Bactericidas, desengrasantes y sanitizantes para restaurantes, hoteles y cocinas industriales. Grado alimentario, cumplimiento SENASA. Entrega en 48hs en AMBA.' },
  { slug: 'edificios', name: 'Edificios y Consorcios', industryKeywords: ['edificios', 'consorcios'],
    heroTitle: 'Productos de limpieza para edificios, consorcios y espacios corporativos',
    heroDesc: 'Ceras acrílicas, detergentes concentrados, desinfectantes y aromatizantes para edificios, consorcios y facility management. Menor costo por metro cuadrado sin resignar resultado.',
    seoTitle: 'Productos de limpieza para edificios y consorcios | FEMAVI',
    seoDesc: 'Ceras acrílicas, detergentes y desinfectantes para edificios, consorcios y facility management. Precios mayoristas, entrega 48hs en AMBA. Fabricación propia argentina.' },
  { slug: 'industria', name: 'Industria y Manufactura', industryKeywords: ['industria', 'industrial', 'metalúrgica', 'manufactura', 'minería', 'minera', 'química', 'eléctrica', 'maquinaria', 'automotriz'],
    heroTitle: 'Productos químicos industriales para manufactura, plantas y procesos productivos',
    heroDesc: 'Lubricantes, anticorrosivos, desengrasantes, desmoldantes, solventes dieléctricos y tratamiento de agua para plantas industriales y líneas de producción. Un solo proveedor para todas las necesidades de tu planta, con fórmulas de desarrollo propio.',
    seoTitle: 'Productos químicos industriales para manufactura y plantas | FEMAVI',
    seoDesc: 'Lubricantes, anticorrosivos, desengrasantes y desmoldantes para industria y manufactura. Fórmulas propias, fichas técnicas completas. Entrega 48hs. +50 años fabricando en Argentina.' },
  { slug: 'limpieza', name: 'Empresas de Limpieza', industryKeywords: ['limpieza'],
    heroTitle: 'Productos para empresas de limpieza profesional: alta concentración, máximo margen',
    heroDesc: 'Línea completa de productos de limpieza y desinfección de alta concentración para empresas de limpieza profesional, facility management y distribuidores. Precios mayoristas, entrega en 48 hs y fórmulas que rinden más.',
    seoTitle: 'Productos mayoristas para empresas de limpieza profesional | FEMAVI',
    seoDesc: 'Productos de limpieza de alta concentración para empresas de limpieza y facility management. Precios mayoristas, alta dilución, fichas técnicas. Entrega 48hs en AMBA.' },
];

// Espejo del <SEO> de Home.tsx, About.tsx y Blog.tsx — mantener en sync.
const STATIC_PAGES = {
  home: {
    title: 'Productos Químicos Industriales en Argentina — FEMAVI',
    desc: 'Fabricantes argentinos de productos químicos industriales con +50 años: desengrasantes, bactericidas, ceras acrílicas, lubricantes y aerosoles. Fórmulas de desarrollo propio, entrega en 48 hs en todo el país. +20.000 clientes.',
  },
  nosotros: {
    title: 'Nosotros — FEMAVI fabricantes argentinos desde 1970',
    desc: 'Más de 50 años fabricando productos químicos industriales en Argentina. Fórmulas de desarrollo propio diseñadas por ingenieros, representantes comerciales capacitados y servicio post-venta personalizado. +20.000 clientes en 24 provincias.',
  },
  catalogo: {
    title: 'Catálogo de productos químicos industriales — FEMAVI',
    desc: 'Catálogo completo: desengrasantes, bactericidas, ceras acrílicas, lubricantes, aerosoles, anticorrosivos. Fórmulas de desarrollo propio FEMAVI con ficha técnica y pedidos en 48 hs.',
  },
  blog: {
    title: 'Blog FEMAVI — Guías y recursos sobre productos industriales',
    desc: 'Artículos técnicos sobre desengrasantes, lubricantes, desinfectantes y limpieza industrial. Guías prácticas para elegir el producto correcto.',
  },
};

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
  table: 'width:100%;border-collapse:collapse;margin:0 0 24px;font-size:15px',
  th: 'text-align:left;padding:10px 12px;background:#f6f8fa;border:1px solid #e2e8ee;font-weight:700;color:#004370',
  td: 'padding:10px 12px;border:1px solid #e2e8ee',
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

/** Lista de productos con nombre + función. Es el grueso de la superficie de keywords. */
function productList(products) {
  return `<ul style="${S.ul}">${products
    .map(p => `<li><a style="${S.link}" href="/catalogo/${esc(p.slug)}">${esc(p.name)}</a>${p.headline ? ` — ${esc(p.headline)}` : ''}${p.subcategory ? ` <span>(${esc(p.subcategory)})</span>` : ''}</li>`)
    .join('')}</ul>`;
}

function categoryLinks() {
  return `<h2 style="${S.h2}">Categorías de producto</h2><ul style="${S.ul}">${CATEGORIES
    .map(c => `<li><a style="${S.link}" href="/catalogo/categoria/${c.slug}">${esc(c.name)}</a> — ${esc(c.heroTitle)}</li>`)
    .join('')}</ul>`;
}

function verticalLinks() {
  return `<h2 style="${S.h2}">Soluciones por industria</h2><ul style="${S.ul}">${VERTICALS
    .map(v => `<li><a style="${S.link}" href="/industrias/${v.slug}">${esc(v.name)}</a> — ${esc(v.heroTitle)}</li>`)
    .join('')}</ul>`;
}

function homeBody(products) {
  const destacados = products.filter(p => p.featured).slice(0, 12);
  return `<div style="${S.wrap}">
<article>
  <h1 style="${S.h1}">Productos químicos industriales de fabricación argentina</h1>
  <h2 style="${S.lead}">Más de 50 años desarrollando fórmulas propias. +20.000 clientes, entrega en 48 hs.</h2>
  <p style="${S.p}">FEMAVI fabrica desengrasantes industriales, bactericidas, ceras acrílicas, anticorrosivos, lubricantes especiales, aerosoles y productos de higiene industrial. Desarrollamos cada fórmula internamente en nuestra planta de Ibarrola 7071, Liniers, CABA, y podemos adaptarla al proceso de cada cliente.</p>
  ${categoryLinks()}
  ${verticalLinks()}
  ${destacados.length ? `<h2 style="${S.h2}">Productos destacados</h2>${productList(destacados)}` : ''}
  <a style="${S.cta}" href="/catalogo">Ver el catálogo completo</a>
</article>
</div>`;
}

function catalogBody(products) {
  return `<div style="${S.wrap}">
<nav aria-label="breadcrumb" style="${S.crumb}"><a style="${S.crumbLink}" href="/">Inicio</a> › <span>Catálogo</span></nav>
<article>
  <h1 style="${S.h1}">Catálogo de productos químicos industriales</h1>
  <h2 style="${S.lead}">${products.length} productos de desarrollo propio, con ficha técnica y cotización directa.</h2>
  <p style="${S.p}">Desengrasantes, bactericidas y desinfectantes, ceras acrílicas, anticorrosivos, lubricantes, grasas, aerosoles, desmoldantes, detergentes, lavamanos, insecticidas y tratamiento de aguas. Fabricación argentina con entrega en 48 hs en AMBA.</p>
  ${categoryLinks()}
  <h2 style="${S.h2}">Todos los productos (${products.length})</h2>
  ${productList(products)}
  <a style="${S.cta}" href="/cotizar">Solicitar cotización</a>
</article>
</div>`;
}

function aboutBody() {
  return `<div style="${S.wrap}">
<nav aria-label="breadcrumb" style="${S.crumb}"><a style="${S.crumbLink}" href="/">Inicio</a> › <span>Nosotros</span></nav>
<article>
  <h1 style="${S.h1}">FEMAVI: fabricantes argentinos de productos químicos industriales desde 1970</h1>
  <p style="${S.p}">Más de 50 años fabricando productos químicos industriales en Argentina. Nuestras fórmulas son de desarrollo propio, diseñadas por ingenieros en nuestra planta de Liniers, CABA, y ajustadas al proceso real de cada cliente.</p>
  <p style="${S.p}">Atendemos a más de 20.000 clientes en 24 provincias: plantas industriales, flotas de transporte, cocinas y establecimientos gastronómicos, edificios y consorcios, talleres mecánicos, empresas de limpieza profesional y comercios. Cada producto se entrega con ficha técnica y hoja de seguridad, y contamos con representantes comerciales capacitados y servicio post-venta.</p>
  ${categoryLinks()}
  ${verticalLinks()}
  <a style="${S.cta}" href="/catalogo">Ver el catálogo completo</a>
</article>
</div>`;
}

function verticalBody(v, products) {
  return `<div style="${S.wrap}">
<nav aria-label="breadcrumb" style="${S.crumb}"><a style="${S.crumbLink}" href="/">Inicio</a> › <span>${esc(v.name)}</span></nav>
<article>
  <h1 style="${S.h1}">${esc(v.heroTitle)}</h1>
  <p style="${S.p}">${esc(v.heroDesc)}</p>
  ${products.length ? `<h2 style="${S.h2}">Productos recomendados para ${esc(v.name)} (${products.length})</h2>${productList(products)}` : ''}
  <a style="${S.cta}" href="/cotizar">Solicitar cotización</a>
</article>
</div>`;
}

function blogListBody(articles) {
  return `<div style="${S.wrap}">
<nav aria-label="breadcrumb" style="${S.crumb}"><a style="${S.crumbLink}" href="/">Inicio</a> › <span>Blog</span></nav>
<article>
  <h1 style="${S.h1}">Blog técnico FEMAVI</h1>
  <p style="${S.p}">Guías prácticas sobre desengrasantes, lubricantes, desinfectantes, ceras y limpieza industrial: cómo elegir el producto correcto para cada aplicación.</p>
  ${articles.length ? `<ul style="${S.ul}">${articles
    .map(a => `<li><a style="${S.link}" href="/blog/${esc(a.slug)}">${esc(a.title)}</a>${a.excerpt ? ` — ${esc(a.excerpt)}` : ''}</li>`)
    .join('')}</ul>` : '<p>Próximamente.</p>'}
</article>
</div>`;
}

/** Markdown → HTML mínimo: headings, párrafos, links, negritas, listas y tablas.
 *  No usamos una librería de markdown para no sumar una dependencia al build; alcanza
 *  con cubrir lo que realmente escriben los posts.
 *
 *  Las tablas importan para SEO: varios posts comparan grados de viscosidad, dosis o
 *  normativas en tablas, y son justamente el dato que la gente busca ("iso vg 46
 *  equivalente sae"). Renderizadas como párrafo con pipes, Google leía un choclo
 *  ilegible; como <table> lee una fila por grado. */
function inline(text) {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a style="${S.link}" href="$2">$1</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Una fila `| a | b |` → celdas. Ignora los pipes de los extremos. */
function celdas(linea) {
  return linea.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

const ES_SEPARADOR = /^\|?[\s:-]*-[\s:|-]*\|?$/;

function tabla(lineas) {
  const head = celdas(lineas[0]);
  const filas = lineas.slice(2).map(celdas);
  const th = head.map(c => `<th style="${S.th}">${inline(c)}</th>`).join('');
  const tr = filas
    .map(f => `<tr>${f.map(c => `<td style="${S.td}">${inline(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table style="${S.table}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function miniMarkdown(md) {
  return String(md ?? '')
    .split(/\n{2,}/)
    .map(block => {
      const b = block.trim();
      if (!b) return '';

      const h = b.match(/^(#{2,4})\s+(.*)$/s);
      if (h) return `<h2 style="${S.h2}">${inline(h[2].replace(/\n[\s\S]*$/, ''))}</h2>`;

      const lineas = b.split('\n').map(l => l.trim()).filter(Boolean);

      // Tabla GFM: encabezado + separador (|---|---|) + al menos una fila.
      if (lineas.length >= 3 && lineas[0].includes('|') && ES_SEPARADOR.test(lineas[1])) {
        return tabla(lineas);
      }

      // Lista: todas las líneas arrancan con - o *.
      if (lineas.every(l => /^[-*]\s+/.test(l))) {
        const li = lineas.map(l => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('');
        return `<ul style="${S.ul}">${li}</ul>`;
      }

      return `<p style="${S.p}">${inline(b)}</p>`;
    })
    .join('');
}

function blogPostBody(a) {
  return `<div style="${S.wrap}">
<nav aria-label="breadcrumb" style="${S.crumb}"><a style="${S.crumbLink}" href="/">Inicio</a> › <a style="${S.crumbLink}" href="/blog">Blog</a> › <span>${esc(a.title)}</span></nav>
<article>
  <h1 style="${S.h1}">${esc(a.title)}</h1>
  ${a.excerpt ? `<h2 style="${S.lead}">${esc(a.excerpt)}</h2>` : ''}
  ${miniMarkdown(a.content)}
  <a style="${S.cta}" href="/cotizar">Consultar por estos productos</a>
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
 * Escribe la página como dist/<ruta>/index.html (ej. dist/catalogo/citrif/index.html).
 *
 * HISTORIA DE ESTE ARCHIVO — no volver a cambiarlo sin probar en producción:
 * 1. Primer intento: dist/catalogo/citrif/index.html. En `vite preview` local solo
 *    resolvía con barra final (/catalogo/citrif/), así que parecía roto.
 * 2. Segundo intento: archivo plano dist/catalogo/citrif.html + "cleanUrls": true.
 *    Andaba local, pero en producción cleanUrls rompió el rewrite de fallback del SPA
 *    y /catalogo, /nosotros, /blog y /industrias/* pasaron a devolver 404.
 * 3. Al quitar cleanUrls los 404 se arreglaron, pero Vercel dejó de resolver los .html
 *    planos y las fichas volvieron a servir el shell vacío.
 * 4. Actual: directorio + index.html SIN cleanUrls. Vercel resuelve /catalogo/citrif
 *    contra catalogo/citrif/index.html de forma nativa (es como sirve cualquier SSG),
 *    y el rewrite de fallback sigue funcionando para las rutas sin archivo.
 * La lección: `vite preview` no reproduce el routing de Vercel. Verificar en producción.
 */
function writePage(routePath, html) {
  const dir = join(OUT_DIR, ...routePath.split('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
}

// ─── main ───
const templatePath = join(OUT_DIR, 'index.html');
if (!existsSync(templatePath)) {
  console.error(`[prerender] no existe ${templatePath} — corré "vite build" antes.`);
  process.exit(1);
}
const template = readFileSync(templatePath, 'utf8');

const [products, articles] = await Promise.all([
  fetchTable(
    'products',
    'slug,name,category,subcategory,headline,description,story,industries,benefits,presentations,dilution,ph,image_url,featured',
    'is_active=eq.true&order=display_order.asc'
  ),
  fetchTable('articles', 'slug,title,excerpt,content', 'published=eq.true&order=published_at.desc'),
]);

if (products.length === 0) {
  console.warn('[prerender] sin productos (¿faltan env vars de Supabase?) — no se prerenderiza nada.');
  process.exit(0);
}

let count = 0;

const breadcrumb = items => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.name, item: it.url,
  })),
});

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
      // Sin bloque `offers` a propósito: Google exige `price` dentro de Offer, y FEMAVI
      // vende por cotización, no publica precios. Declarar un Offer sin precio hacía que
      // Search Console marcara la ficha como "elemento no válido" en Fragmentos de
      // productos y Fichas de comerciantes. Sin offers el Product sigue siendo válido;
      // solo no califica para el snippet de precio, que igual no tendríamos.
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

// ── Catálogo completo: es la página con más superficie de keywords del sitio,
//    porque lista los ~200 nombres de producto junto a su función. ──
writePage('catalogo', renderPage(template, {
  title: STATIC_PAGES.catalogo.title,
  description: STATIC_PAGES.catalogo.desc,
  canonical: `${SITE_URL}/catalogo`,
  jsonLd: [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}/catalogo#webpage`,
      url: `${SITE_URL}/catalogo`,
      name: STATIC_PAGES.catalogo.title,
      description: STATIC_PAGES.catalogo.desc,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Productos químicos industriales FEMAVI',
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/catalogo/${p.slug}`, name: p.name,
      })),
    },
    breadcrumb([
      { name: 'Inicio', url: SITE_URL },
      { name: 'Catálogo', url: `${SITE_URL}/catalogo` },
    ]),
  ],
  bodyHtml: catalogBody(products),
}));
count++;

// ── Shell neutro para el fallback del SPA ──
// dist/index.html se usa para DOS cosas distintas: es la home, y es el destino del rewrite
// de vercel.json para toda ruta sin archivo propio (/cotizar, /pedidos, /admin/*, slugs
// inexistentes). Si prerenderizamos la home ahí, esas rutas pasan a servir el contenido y
// el canonical de la home — exactamente el bug de "todo es duplicado de la home" que este
// trabajo vino a arreglar.
// Solución: el fallback apunta a app.html (shell neutro, sin canonical propio: lo pone
// React según la ruta) y dist/index.html queda libre para ser la home de verdad.
writeFileSync(
  join(OUT_DIR, 'app.html'),
  template
    .replace(/<link data-default rel="canonical" href="[\s\S]*?" \/>/, '')
    .replace(/<meta data-default name="description" content="[\s\S]*?" \/>/, ''),
  'utf8'
);

// ── Home (dist/index.html) ──
writeFileSync(
  join(OUT_DIR, 'index.html'),
  renderPage(template, {
    title: STATIC_PAGES.home.title,
    description: STATIC_PAGES.home.desc,
    canonical: `${SITE_URL}/`,
    jsonLd: breadcrumb([{ name: 'Inicio', url: SITE_URL }]),
    bodyHtml: homeBody(products),
  }),
  'utf8'
);
count++;

// ── Nosotros ──
writePage('nosotros', renderPage(template, {
  title: STATIC_PAGES.nosotros.title,
  description: STATIC_PAGES.nosotros.desc,
  canonical: `${SITE_URL}/nosotros`,
  jsonLd: breadcrumb([
    { name: 'Inicio', url: SITE_URL },
    { name: 'Nosotros', url: `${SITE_URL}/nosotros` },
  ]),
  bodyHtml: aboutBody(),
}));
count++;

// ── Landings por industria ──
for (const v of VERTICALS) {
  const vProducts = products.filter(p =>
    (p.industries ?? []).some(ind => v.industryKeywords.some(kw => ind.toLowerCase().includes(kw)))
  );
  const canonical = `${SITE_URL}/industrias/${v.slug}`;
  writePage(`industrias/${v.slug}`, renderPage(template, {
    title: v.seoTitle,
    description: v.seoDesc,
    canonical,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: v.seoTitle,
        description: v.seoDesc,
      },
      breadcrumb([
        { name: 'Inicio', url: SITE_URL },
        { name: v.name, url: canonical },
      ]),
    ],
    bodyHtml: verticalBody(v, vProducts.slice(0, 40)),
  }));
  count++;
}

// ── Blog ──
writePage('blog', renderPage(template, {
  title: STATIC_PAGES.blog.title,
  description: STATIC_PAGES.blog.desc,
  canonical: `${SITE_URL}/blog`,
  jsonLd: breadcrumb([
    { name: 'Inicio', url: SITE_URL },
    { name: 'Blog', url: `${SITE_URL}/blog` },
  ]),
  bodyHtml: blogListBody(articles),
}));
count++;

for (const a of articles) {
  const canonical = `${SITE_URL}/blog/${a.slug}`;
  writePage(`blog/${a.slug}`, renderPage(template, {
    title: `${a.title} — FEMAVI`,
    description: (a.excerpt || '').slice(0, 158),
    canonical,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: a.title,
        description: a.excerpt,
        mainEntityOfPage: canonical,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      breadcrumb([
        { name: 'Inicio', url: SITE_URL },
        { name: 'Blog', url: `${SITE_URL}/blog` },
        { name: a.title, url: canonical },
      ]),
    ],
    bodyHtml: blogPostBody(a),
  }));
  count++;
}

console.log(
  `[prerender] ✓ ${count} páginas HTML estáticas → ${OUT_DIR}/\n` +
  `             ${products.length} productos · ${CATEGORIES.length} categorías · ${VERTICALS.length} industrias · ` +
  `${articles.length} posts · home · catálogo · nosotros · blog`
);
