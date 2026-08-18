// Avisa a Bing (y a Yandex, Seznam y Naver, que comparten el mismo protocolo) que las
// URLs del sitio cambiaron, en vez de esperar a que pasen a rastrear por su cuenta.
//
// POR QUÉ EXISTE ESTE SCRIPT
// Google tiene Search Console para pedir indexación a mano. Bing no depende de eso:
// tiene IndexNow, que es un POST con la lista de URLs y las mete en la cola de rastreo
// en minutos en vez de semanas. Importa más de lo que parece, porque el índice de Bing
// es el que alimenta a Copilot y el que ChatGPT consulta cuando busca en la web: si una
// ficha no está en Bing, no existe para esos asistentes por más bien hecha que esté.
//
// La clave es pública a propósito: el archivo public/<clave>.txt sirve para que Bing
// verifique que quien manda el aviso controla el dominio. No es un secreto ni da acceso
// a nada — si se borra ese archivo, IndexNow empieza a rechazar los envíos.
//
// Se corre solo en deploys de producción de Vercel (VERCEL_ENV=production). En local o en
// preview no tiene sentido avisar de URLs que todavía no están publicadas.
// Para forzarlo a mano: INDEXNOW_FORCE=1 npm run indexnow
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = process.env.SITE_URL || 'https://www.femavi.com.ar';
const KEY = process.env.INDEXNOW_KEY || '188ae94335cca83934d4b5ae5a074dbe';
const OUT_DIR = process.env.SITEMAP_OUT || 'dist';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

// IndexNow acepta hasta 10.000 URLs por request. El sitio tiene ~240, así que entra
// en una sola, pero el corte queda por si el catálogo crece.
const MAX_URLS = 10000;

const forzado = process.env.INDEXNOW_FORCE === '1';
if (!forzado && process.env.VERCEL_ENV !== 'production') {
  console.log('[indexnow] no es un deploy de producción — no se avisa nada.');
  process.exit(0);
}

const sitemapPath = join(OUT_DIR, 'sitemap.xml');
if (!existsSync(sitemapPath)) {
  console.warn(`[indexnow] no existe ${sitemapPath} — corré "npm run sitemap" antes. Se saltea.`);
  process.exit(0);
}

const xml = readFileSync(sitemapPath, 'utf8');
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(m => m[1].trim())
  .filter(u => u.startsWith(SITE_URL))
  .slice(0, MAX_URLS);

if (urlList.length === 0) {
  console.warn('[indexnow] el sitemap no tiene URLs de este dominio — se saltea.');
  process.exit(0);
}

const host = new URL(SITE_URL).host;
const body = {
  host,
  key: KEY,
  keyLocation: `${SITE_URL}/${KEY}.txt`,
  urlList,
};

try {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  // 200 = aceptado, 202 = aceptado pero la clave todavía se está validando.
  if (r.status === 200 || r.status === 202) {
    console.log(`[indexnow] ✓ ${urlList.length} URLs enviadas a Bing (HTTP ${r.status})`);
  } else if (r.status === 403) {
    console.warn(`[indexnow] clave rechazada (403): revisá que ${body.keyLocation} devuelva "${KEY}" en texto plano.`);
  } else {
    console.warn(`[indexnow] respuesta inesperada ${r.status}: ${await r.text()}`);
  }
} catch (err) {
  // Un aviso fallido no puede tirar abajo un deploy: el sitio ya está construido y
  // Bing lo va a rastrear igual, solo que más tarde.
  console.warn('[indexnow] no se pudo avisar:', err.message);
}
