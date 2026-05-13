// Genera sitemap.xml en build time leyendo productos activos desde Supabase.
// Se corre como postbuild — requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en env.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = process.env.SITE_URL || 'https://femavi-web.vercel.app';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OUT_DIR = process.env.SITEMAP_OUT || 'dist';

const today = new Date().toISOString().split('T')[0];

function urlEntry({ loc, lastmod = today, changefreq = 'weekly', priority = '0.7' }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function fetchProducts() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[sitemap] sin env vars de Supabase — sitemap solo con / y /catalogo');
    return [];
  }
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=slug,updated_at&is_active=eq.true&order=display_order.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!r.ok) {
    console.warn('[sitemap] error supabase:', r.status, await r.text());
    return [];
  }
  return r.json();
}

const products = await fetchProducts();

const entries = [
  urlEntry({ loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0' }),
  urlEntry({ loc: `${SITE_URL}/catalogo`, changefreq: 'daily', priority: '0.9' }),
  urlEntry({ loc: `${SITE_URL}/nosotros`, changefreq: 'monthly', priority: '0.7' }),
  ...products.map(p =>
    urlEntry({
      loc: `${SITE_URL}/catalogo/${p.slug}`,
      lastmod: p.updated_at?.split('T')[0] ?? today,
      changefreq: 'monthly',
      priority: '0.8',
    })
  ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, 'sitemap.xml');
writeFileSync(outPath, xml, 'utf8');
console.log(`[sitemap] ✓ ${entries.length} URLs → ${outPath}`);
