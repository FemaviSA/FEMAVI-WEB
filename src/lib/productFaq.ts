import type { Product } from '../types/product';

/**
 * Preguntas frecuentes por producto, armadas desde los campos de su propia ficha.
 *
 * POR QUÉ EXISTE
 * El sitio describe productos; no responde preguntas. Un asistente de IA que recibe
 * "¿qué desengrasante uso para motores de una flota?" busca un texto que conteste eso
 * literalmente. Una ficha que dice "Disolvente y Emulsionante de Grasas y Aceites" tiene
 * la respuesta adentro, pero no en la forma de la pregunta, y por eso no se recupera.
 *
 * REGLA DE ORO: acá no se inventa nada. Cada respuesta es una reformulación de un campo
 * que ya está cargado en la base. Si el campo está vacío, la pregunta no se genera —
 * preferimos cinco preguntas ciertas a seis con una respuesta rellenada a ojo. Esto
 * importa especialmente con productos químicos: una dilución equivocada arruina material
 * o lastima a alguien.
 *
 * Cobertura real de los campos sobre los 199 productos activos (medida, no estimada):
 * headline, description, industries, benefits y presentations al 100%; dilution al 98%
 * (4 productos sin dato); ph y story al 0%, así que no se usan.
 *
 * IMPORTANTE: esta lógica está espejada en scripts/prerender.mjs (que no puede importar
 * TS). Si cambiás algo acá, cambialo también allá: el HTML prerenderizado tiene que decir
 * exactamente lo mismo que pinta React, o le estaríamos mostrando a Google y a los
 * crawlers de IA un texto distinto al que ve el usuario.
 */

export type FaqItem = { q: string; a: string };

/** Une una lista en castellano: "a, b y c". */
function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Cierra la oración con punto sin duplicarlo cuando el dato ya viene con uno. */
function punto(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Los beneficios están cargados como títulos ("Alta concentración de materia activa"), así
 * que enganchados en medio de una oración quedan con mayúscula en el lugar equivocado.
 * Se baja la inicial salvo que la palabra sea una sigla — "CIP", "MSDS", "ISO" tienen que
 * quedar como están.
 */
function minuscula(s: string): string {
  const t = s.trim().replace(/\.$/, '');
  const primera = t.split(/\s+/)[0] ?? '';
  if (primera.length > 1 && primera === primera.toUpperCase()) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

export function buildProductFaq(p: Product): FaqItem[] {
  const faq: FaqItem[] = [];

  // 1. Qué es y para qué sirve. headline + description, los dos al 100%.
  if (p.description) {
    faq.push({
      q: `¿Para qué sirve ${p.name}?`,
      a: p.headline
        ? `${punto(p.headline)} ${punto(p.description)}`
        : punto(p.description),
    });
  }

  // 2. Dilución. 106 de los 199 productos son "Puro" a secas, así que preguntar
  //    "¿cómo se diluye?" en esos casos daría una pregunta que se contesta sola con
  //    un "no se diluye". Se ramifica para que pregunta y respuesta peguen.
  const dil = p.dilution?.trim();
  if (dil) {
    const esPuro = /^puro$/i.test(dil);
    const esMixto = /^puro o/i.test(dil);
    faq.push({
      q: `¿${p.name} se usa puro o diluido?`,
      a: esPuro
        ? `Se usa puro, sin diluir, tal como viene en el envase.`
        : esMixto
          ? `Admite las dos formas según la aplicación. Su ficha técnica indica: ${punto(dil)}`
          : `Se usa diluido. Su ficha técnica indica: ${punto(dil)}`,
    });
  }

  // 3. Presentaciones. Es la pregunta comercial más frecuente y el dato está al 100%.
  if (p.presentations?.length) {
    faq.push({
      q: `¿En qué presentaciones viene ${p.name}?`,
      a: `${p.name} se entrega en ${enumerar(p.presentations)}. FEMAVI vende a empresas por bidón y por mayor, con entrega en 48 hs en AMBA y despacho al resto del país.`,
    });
  }

  // 4. Industrias. Se enuncia como "según su ficha" a propósito: el campo dice dónde se
  //    usa el producto, que no es lo mismo que una habilitación o certificación.
  if (p.industries?.length) {
    faq.push({
      q: `¿En qué industrias se usa ${p.name}?`,
      a: `Según su ficha técnica, ${p.name} se usa en ${enumerar(p.industries)}.`,
    });
  }

  // 5. Aptitud alimentaria. Solo si la ficha ya lo declara para un rubro alimenticio.
  //    No afirmamos aptitud para contacto directo con alimentos —eso depende del uso y
  //    de la documentación—, se repite lo que dice la ficha y se deriva a la MSDS.
  const alimenticias = (p.industries ?? []).filter(i => /aliment|gastronom/i.test(i));
  if (alimenticias.length) {
    faq.push({
      q: `¿${p.name} se puede usar en industria alimentaria o gastronomía?`,
      a: `Su ficha técnica lo indica para ${enumerar(alimenticias)}. Para usos en contacto directo con alimentos, pedí la ficha técnica y la hoja de seguridad (MSDS) a ventas@femavi.com.ar antes de aplicarlo.`,
    });
  }

  // 6. Beneficios. Entre 4 y 5 por producto en todo el catálogo.
  //    Se unen con punto y coma, no con coma: varios beneficios ya traen comas y dos puntos
  //    adentro ("Triple acción: limpia, desinfecta y desodoriza") y con comas se vuelve ilegible.
  //    La pregunta no compara contra la subcategoría a propósito: son plurales ("Desengrasantes")
  //    y algunas no admiten plural ("Higiene Industrial"), así que "frente a otro X" no concuerda.
  //    El primero abre la oración y conserva su mayúscula; el resto van en minúscula. Un
  //    "Según su ficha técnica:" adelante generaba dos veces dos puntos en los 69 productos
  //    que tienen un ":" dentro de algún beneficio ("Alta dilución económica: hasta 1:150").
  if (p.benefits?.length) {
    const lista = p.benefits
      .map((b, i) => (i === 0 ? b.trim().replace(/\.$/, '') : minuscula(b)))
      .join('; ');
    faq.push({
      q: `¿Qué ventajas tiene ${p.name}?`,
      a: `${lista}. Es de fórmula propia FEMAVI, desarrollada y fabricada en Argentina.`,
    });
  }

  // 7. Precio. Constante del negocio, no del producto: FEMAVI no publica lista.
  //    Va igual porque "cuánto sale" es lo primero que se pregunta, y sin esta
  //    respuesta un modelo se inventa un precio o dice que no consigue el dato.
  faq.push({
    q: `¿Cuánto cuesta ${p.name}?`,
    a: `FEMAVI vende a empresas por cotización y no publica lista de precios: el valor depende del volumen y de la presentación. Se pide presupuesto en https://www.femavi.com.ar/cotizar, por mail a ventas@femavi.com.ar o por WhatsApp al +54 9 11 6228-4649.`,
  });

  return faq;
}

/** El JSON-LD que leen Bing y los modelos. Solo se emite si hay preguntas. */
export function faqJsonLd(faq: FaqItem[]) {
  if (!faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
