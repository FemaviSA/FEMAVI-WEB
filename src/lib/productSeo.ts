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

/**
 * Descriptores escritos a mano, para los casos donde el corte automático se come una
 * palabra que Search Console demuestra que la gente busca.
 *
 * El corte prueba separadores (coma, "con", "para", "y", "de", "en") y se queda con el
 * prefijo más largo que entre en el presupuesto. Con "Limpiador y Abrillantador para
 * Aluminio No Ácido" el único corte posible deja "Limpiador y Abrillantador": se pierde
 * justo "Aluminio", que es la palabra por la que buscan la ficha.
 *
 * Antes de escribirlos a mano se evaluó mejorar el algoritmo. No hace falta: recortarAPalabra
 * ya extiende hasta el último límite de palabra cuando ningún separador sirve, así que el
 * corte por palabra ya está cubierto. Revisados los 199 títulos construidos, solo 5 salían
 * mal, y todos por lo mismo: el corte caía a la mitad de una especificación técnica
 * ("…ISO VG" sin el número, "…NLGI" sin el grado) o en un adverbio ("…parafínico
 * altamente"). Enseñarle esas excepciones al algoritmo pedía una lista de unidades y de
 * adverbios que igual habría que mantener a mano — con la diferencia de que un error ahí
 * afecta a los 199 títulos en vez de a uno. Por eso van como excepciones explícitas.
 *
 * Ojo con los finales que PARECEN rotos y no lo están: "NLGI 2", "EP", "MoS₂" y "SAE 68"
 * son designaciones técnicas completas. No agregarlas a ninguna lista de "colgadas".
 *
 * La clave es el slug, no el nombre, porque el nombre puede cambiar.
 * Mantener en sync con scripts/prerender.mjs.
 */
const DESCRIPTOR_A_MANO: Record<string, string> = {
  // "alubril aluminio": 2 impresiones, posición 9,0. El título decía solo
  // "Limpiador y Abrillantador", sin la palabra que se busca.
  'alubril': 'Limpiador y Abrillantador para Aluminio',
  // "pasivante acero inoxidable": 2 impresiones, posición 11,5. El título decía
  // "Pasivante" a secas.
  'pasinox-200-300': 'Pasivante para Acero Inoxidable',
  'pasinox-400': 'Pasivante para Acero Inoxidable',

  // Los cuatro de abajo salían con el corte partido a la mitad de una especificación o
  // en un adverbio: "…ISO VG" sin el número, "…ISO" solo, "…parafínico altamente",
  // "…NLGI" sin el grado. Se revisaron los 199 títulos construidos y son los únicos
  // cuatro rotos de verdad; el resto de los finales que parecen sospechosos ("NLGI 2",
  // "EP", "MoS₂", "SAE 68") son designaciones técnicas completas y correctas.
  'oil-plus-300': 'Aceite hidráulico ISO VG 68',
  'oil-plus-iso-vg-32': 'Aceite hidráulico ISO VG-32',
  'oil-term': 'Aceite térmico parafínico refinado',
  'grasa-grafitada': 'Grasa grafitada NLGI 1-2',
  'aerosol-grasa-grafitada': 'Aerosol de grasa NLGI 1-2',
};

export function buildProductTitle(product: Pick<Product, 'slug' | 'name' | 'headline' | 'category' | 'subcategory'>): string {
  const nombre = product.name.trim();
  const presupuesto = MAX_TITLE - BRAND.length - nombre.length - 3; // 3 = ' — '

  const aMano = DESCRIPTOR_A_MANO[product.slug];
  if (aMano && aMano.length <= presupuesto) return `${nombre} — ${aMano}${BRAND}`;

  if (presupuesto >= MIN_DESCRIPTOR) {
    const d = descriptorDe(product.headline, presupuesto);
    if (d) return `${nombre} — ${d}${BRAND}`;

    const tipo = GENERICO[(product.subcategory ?? product.category ?? '').trim()];
    if (tipo && tipo.length <= presupuesto) return `${nombre} — ${tipo}${BRAND}`;
  }
  // El nombre ya ocupa el presupuesto; suele ser descriptivo de por sí.
  return `${nombre}${BRAND}`;
}

/**
 * La meta description es el texto que Google muestra debajo del título: es lo que
 * termina de convencer del clic. Antes se pegaba headline + description + la frase
 * comercial y se recortaba a 158 con "…". Como las descripciones promedian 321
 * caracteres, las 199 fichas salían cortadas al medio y en ninguna llegaba a verse
 * "entrega en 48 hs" — el recorte se comía justo el argumento de venta.
 *
 * Ahora el cierre comercial tiene su lugar reservado y el cuerpo se arma con
 * oraciones enteras hasta donde entren.
 */
const MAX_DESC = 155;
const CIERRE = 'Fabricación propia FEMAVI, entrega en 48 hs.';

/** Parte en oraciones: corta en punto seguido de mayúscula, así no rompe siglas. */
function oraciones(texto: string | null | undefined): string[] {
  return String(texto ?? '')
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function buildProductDescription(
  product: Pick<Product, 'name' | 'headline' | 'description' | 'subcategory' | 'category'>,
): string {
  const presupuesto = MAX_DESC - CIERRE.length - 1;

  const h = (product.headline ?? '').trim().replace(/[.\s]+$/, '');
  const d = (product.description ?? '').trim();

  let cuerpo = '';
  if (h) cuerpo = h.length <= presupuesto ? `${h}.` : `${recortarAPalabra(h, presupuesto - 1)}.`;

  if (cuerpo.length < presupuesto) {
    for (const o of oraciones(d)) {
      const cand = cuerpo ? `${cuerpo} ${o}` : o;
      if (cand.length <= presupuesto) cuerpo = cand;
      else break;
    }
  }

  if (!cuerpo) {
    const r = recortarAPalabra(d, presupuesto - 1);
    cuerpo = r ? `${r}.` : '';
  }

  // Si sobró lugar, el cierre suma el genérico del rubro: es la palabra que la
  // gente escribe en Google y evita desperdiciar la mitad del espacio visible.
  const generico = GENERICO[(product.subcategory ?? product.category ?? '').trim()];
  if (generico) {
    const largo = `${generico} de fabricación propia FEMAVI, entrega en 48 hs.`;
    if (`${cuerpo} ${largo}`.length <= MAX_DESC) return cuerpo ? `${cuerpo} ${largo}` : largo;
  }
  return cuerpo ? `${cuerpo} ${CIERRE}` : CIERRE;
}
