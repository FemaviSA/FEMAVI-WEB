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

const MAX_TITLE_LEAD = 62;

export function buildProductTitle(product: Pick<Product, 'name' | 'headline' | 'category' | 'subcategory'>): string {
  const descriptor = product.headline?.trim() || `${product.subcategory ?? product.category} industrial`;
  let lead = `${product.name} — ${descriptor}`;
  if (lead.length > MAX_TITLE_LEAD) lead = `${lead.slice(0, MAX_TITLE_LEAD - 1).trimEnd()}…`;
  return `${lead} | FEMAVI`;
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
