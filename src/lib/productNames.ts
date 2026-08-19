/**
 * Grafías alternativas con las que la gente busca un producto.
 *
 * POR QUÉ EXISTE
 * Search Console muestra que buscan los productos pegando las dos palabras del nombre:
 * "lubrifem" (8 impresiones, posición 8,4) y "crystalcar" (3 impresiones, posición 5,3).
 * Las fichas se llaman LUBRI FEM y CRYSTAL CAR, así que esa grafía no aparece en ninguna
 * parte de la página y Google la matchea solo por aproximación. Son búsquedas de gente que
 * ya conoce el producto y lo quiere comprar: perder posiciones ahí es caro.
 *
 * POR QUÉ ES UNA LISTA A MANO Y NO UNA REGLA
 * La regla obvia sería "a todo nombre de dos palabras, agregarle la versión pegada". Sobre
 * el catálogo real eso genera basura: hay 77 productos de dos palabras y la mayoría daría
 * cosas que nadie escribe nunca — ACEITE ALIMENTICIO → "aceitealimenticio", PULINOX F →
 * "pulinoxf", LUBE A → "lubea". Serían 77 fichas con una línea de ruido para ganar dos
 * casos reales. Acá se agregan solo los que tienen evidencia de búsqueda.
 *
 * CÓMO AGREGAR UNO
 * Buscar la grafía en el informe de rendimiento de Search Console. Si tiene impresiones y
 * no está en la ficha, sumarla acá con su slug. La clave es el slug, no el nombre, porque
 * el nombre puede cambiar.
 *
 * Espejado en scripts/prerender.mjs — mantener en sync.
 */
const GRAFIAS: Record<string, string[]> = {
  'lubri-fem': ['LUBRIFEM'],
  'crystal-car': ['CRYSTALCAR'],
};

export function grafiasDe(slug: string): string[] {
  return GRAFIAS[slug] ?? [];
}
