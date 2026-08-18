import type { Product } from '../types/product';

/**
 * Construcción de title y meta description por producto.
 *
 * Regla clave: el título tiene que llevar adelante la FUNCIÓN del producto, no la marca.
 * La gente busca "desengrasante industrial con base cítrica", no "CITRIF". Antes el título
 * era "CITRIF — Higiene Industrial industrial argentino | FEMAVI", que no contiene ninguna
 * de las palabras que la gente realmente escribe en Google.
 *
 * IMPORTANTE: esta lógica está espejada en scripts/prerender.mjs (que no puede importar TS).
 * Si cambiás algo acá, cambialo también allá para que el HTML prerenderizado y el que pinta
 * React coincidan — si difieren, Google puede ver un título distinto al del usuario.
 */

/**
 * El título entero tiene que entrar en lo que Google muestra (~60 caracteres).
 * Antes se cortaba el headline a lo bruto y se le pegaba "…", así que 161 de las
 * 199 fichas aparecían en los resultados con la frase cortada al medio
 * ("OIL PLUS ISO VG-32 — Aceite hidráulico mineral ISO VG-32 con…").
 * Ahora se corta en un punto donde la frase cierra sola.
 */
const MAX_TITLE = 60;
const BRAND = ' | FEMAVI';
const MIN_DESCRIPTOR = 14;

/** Los headlines siguen el patrón "<qué es> con <aditivos> para <aplicación>". */
const CORTES = [', ', ' con ', ' para ', ' que ', ' y ', ' de ', ' en '];

/** Terminar en una de estas deja la frase colgada ("Aceite de baja"). */
const COLGADAS = new Set([
  'de', 'del', 'con', 'para', 'en', 'y', 'e', 'o', 'a', 'al', 'por', 'sin', 'sobre',
  'la', 'el', 'los', 'las', 'un', 'una', 'su', 'sus',
  'alto', 'alta', 'bajo', 'baja', 'gran', 'mayor', 'menor', 'muy', 'más',
]);

/** Genérico por rubro, con la palabra que la gente escribe en Google. Solo se usa
 *  cuando el headline no deja nada aprovechable. */
const GENERICO: Record<string, string> = {
  'Lubricantes': 'Lubricante industrial',
  'Aceites y Aditivos': 'Aceite industrial',
  'Grasas': 'Grasa industrial',
  'Desengrasantes': 'Desengrasante industrial',
  'Limpiadores': 'Limpiador industrial',
  'Detergentes': 'Detergente industrial',
  'Desinfectantes': 'Desinfectante industrial',
  'Anticorrosivos': 'Anticorrosivo industrial',
  'Aerosoles': 'Aerosol industrial',
  'Desmoldantes': 'Desmoldante industrial',
  'Ceras': 'Cera para pisos',
  'Lavamanos': 'Jabón de manos industrial',
  'Higiene Industrial': 'Producto de higiene industrial',
  'Tratamiento para Aguas': 'Tratamiento de agua',
  'Insecticida': 'Insecticida industrial',
  'Línea Automotor': 'Producto para automotor',
};

function quedaColgado(texto: string): boolean {
  const ultima = texto.trim().split(/\s+/).pop() ?? '';
  return COLGADAS.has(ultima.toLowerCase());
}

function recortarAPalabra(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max + 1).lastIndexOf(' ');
  if (corte <= 0) return '';
  let t = texto.slice(0, corte).replace(/[\s,;:.-]+$/, '');
  while (t && quedaColgado(t)) {
    const i = t.lastIndexOf(' ');
    if (i <= 0) return '';
    t = t.slice(0, i).replace(/[\s,;:.-]+$/, '');
  }
  return t;
}

function descriptorDe(headline: string | null | undefined, presupuesto: number): string {
  const h = (headline ?? '').trim();
  if (!h) return '';
  if (h.length <= presupuesto && !quedaColgado(h)) return h;

  const candidatos: string[] = [];
  for (const sep of CORTES) {
    const i = h.indexOf(sep);
    if (i > 0) candidatos.push(h.slice(0, i).replace(/[\s,;:.-]+$/, ''));
  }
  const cabe = candidatos
    .filter(c => c.length <= presupuesto && c.length >= MIN_DESCRIPTOR && !quedaColgado(c))
    .sort((a, b) => b.length - a.length);
  if (cabe.length) return cabe[0];

  const porPalabra = recortarAPalabra(h, presupuesto);
  return porPalabra.length >= MIN_DESCRIPTOR ? porPalabra : '';
}

export function buildProductTitle(product: Pick<Product, 'name' | 'headline' | 'category' | 'subcategory'>): string {
  const nombre = product.name.trim();
  const presupuesto = MAX_TITLE - BRAND.length - nombre.length - 3; // 3 = ' — '

  if (presupuesto >= MIN_DESCRIPTOR) {
    const d = descriptorDe(product.headline, presupuesto);
    if (d) return `${nombre} — ${d}${BRAND}`;

    const tipo = GENERICO[(product.subcategory ?? product.category ?? '').trim()];
    if (tipo && tipo.length <= presupuesto) return `${nombre} — ${tipo}${BRAND}`;
  }
  // El nombre ya ocupa el presupuesto; suele ser descriptivo de por sí.
  return `${nombre}${BRAND}`;
}

export function buildProductDescription(
  product: Pick<Product, 'name' | 'headline' | 'description' | 'subcategory' | 'category'>,
): string {
  const tipo = product.subcategory ?? product.category;
  const base = product.headline?.trim()
    ? `${product.headline.trim()}. ${product.description}`
    : product.description;
  const withBrand = `${base} ${tipo} de fabricación propia FEMAVI, entrega en 48 hs.`;
  return withBrand.length > 158 ? `${withBrand.slice(0, 157).trimEnd()}…` : withBrand;
}
