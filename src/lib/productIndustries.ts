/**
 * A qué páginas de industria pertenece un producto.
 *
 * POR QUÉ EXISTE
 * El campo `industries` de cada producto tiene texto libre y bastante disperso
 * ("Industria Metalúrgica", "Metalúrgica", "Industrial"…): 39 valores distintos para
 * 199 productos. Las páginas /industrias/* arman su listado buscando palabras clave
 * dentro de ese texto. Este módulo hace ese mismo match pero al revés — dado un
 * producto, a qué industrias corresponde — para poder enlazarlas desde su ficha.
 *
 * Enlazarlas importa para SEO: antes de esto, sólo 8 de las 242 páginas del sitio
 * apuntaban a /industrias/*, contra 226 que apuntan al catálogo. Google lee los
 * enlaces internos como señal de importancia, y esas cinco páginas quedaban como
 * rincones sin visitas. Cada ficha ya sabe a qué industrias sirve; sólo faltaba
 * decirlo con un enlace.
 *
 * IMPORTANTE: los keywords están espejados en scripts/prerender.mjs (VERTICALS), que
 * no puede importar TS. Si cambiás uno, cambiá el otro: si difieren, la ficha
 * enlazaría a una industria cuyo listado no incluye ese producto.
 */

export interface Vertical {
  slug: string;
  name: string;
  keywords: string[];
}

export const VERTICALES: Vertical[] = [
  { slug: 'transporte', name: 'Transporte y Flotas', keywords: ['transporte'] },
  { slug: 'gastronomia', name: 'Gastronomía y Alimenticia', keywords: ['gastronomía', 'hotelería', 'alimenticia'] },
  { slug: 'edificios', name: 'Edificios y Consorcios', keywords: ['edificios', 'consorcios'] },
  {
    slug: 'industria',
    name: 'Industria y Manufactura',
    keywords: ['industria', 'industrial', 'metalúrgica', 'manufactura', 'minería', 'minera', 'química', 'eléctrica', 'maquinaria', 'automotriz'],
  },
  { slug: 'limpieza', name: 'Empresas de Limpieza', keywords: ['limpieza'] },
];

export function verticalesDe(industries: string[] | null | undefined): Vertical[] {
  const lista = industries ?? [];
  return VERTICALES.filter(v =>
    lista.some(ind => v.keywords.some(kw => ind.toLowerCase().includes(kw))),
  );
}
