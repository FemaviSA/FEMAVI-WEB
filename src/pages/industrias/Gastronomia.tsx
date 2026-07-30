import { VerticalPage } from '../VerticalPage';
import type { VerticalConfig } from '../VerticalPage';

const config: VerticalConfig = {
  slug: 'gastronomia',
  icon: '🍳',
  name: 'Gastronomía y Alimenticia',
  heroTitle: 'Productos de limpieza para gastronomía, restaurantes y cocinas industriales',
  heroDesc: 'Bactericidas, desengrasantes y sanitizantes de grado alimentario para restaurantes, hoteles, comedores industriales, catering y plantas de alimentos. Cumplimos con los requerimientos SENASA y ANMAT para la industria alimenticia.',
  seoTitle: 'Productos de limpieza para gastronomía y cocinas industriales | FEMAVI',
  seoDesc: 'Bactericidas, desengrasantes y sanitizantes para restaurantes, hoteles y cocinas industriales. Grado alimentario, cumplimiento SENASA. Entrega en 48hs en AMBA.',
  keywords: 'bactericida cocina industrial, productos limpieza gastronomía, desengrasante apto alimentos, sanitizante cocina profesional, limpieza restaurante SENASA, productos higiene gastronomía Argentina',
  color: '#0067ac',
  products: [
    { name: 'Bactericida de Grado Alimentario', desc: 'Desinfectante sin enjuague para superficies en contacto con alimentos. Eliminación de bacterias patógenas (Salmonella, Listeria, E.coli). Aprobado para uso en industria alimentaria.' },
    { name: 'Desengrasante Alcalino para Cocinas', desc: 'Disuelve grasa animal y vegetal polimerizada en hornos, freidoras, plancha y campanas. Alta concentración, rendimiento máximo.' },
    { name: 'Desincrustante para Equipos de Vapor', desc: 'Elimina sarro e incrustaciones calcáreas en hornos combinados, cafeteras y equipos que trabajan con agua. Compatible con acero inoxidable.' },
    { name: 'Desengrasante Neutro para Acero Inox', desc: 'Para mesadas, piletas y equipos de acero inoxidable. No raya, no altera el acabado superficial ni deja residuos.' },
    { name: 'Detergente Lavavajillas Industrial', desc: 'Formulado para máquinas lavavajillas de alta temperatura. Actúa entre 60-85°C, sin espuma excesiva, secado rápido.' },
    { name: 'Limpiador de Pisos Antideslizantes', desc: 'Para pisos de cocina con superficie antideslizante. No reduce la fricción de seguridad ni deja residuos resbaladizos.' },
  ],
  benefits: [
    { icon: '🏥', title: 'Grado alimentario', desc: 'Todos nuestros productos para cocinas cumplen con los requisitos de uso en ambientes de manipulación de alimentos. Proveemos fichas técnicas y certificados.' },
    { icon: '📋', title: 'Cumplimiento SENASA', desc: 'Documentación completa para auditorías del SENASA, municipios y certificaciones BPM. Sin sorpresas en las inspecciones.' },
    { icon: '🔬', title: 'Amplio espectro bactericida', desc: 'Nuestros desinfectantes eliminan las bacterias más comunes en cocinas industriales: Salmonella, Listeria, E.coli y Staphylococcus.' },
    { icon: '💰', title: 'Alta dilución, bajo costo', desc: 'Productos concentrados que rinden mucho más que los de supermercado. El costo por litro de solución lista es significativamente menor.' },
    { icon: '⚡', title: 'Entrega en 48 hs', desc: 'Para que nunca te quedes sin producto a mitad de semana. Pedidos recurrentes con frecuencia fija disponible.' },
    { icon: '🤝', title: 'Asesoría en protocolos', desc: 'Te ayudamos a diseñar el programa de limpieza de tu cocina: qué producto usar en cada superficie, diluciones y frecuencias.' },
  ],
  faq: [
    { q: '¿Sus bactericidas son aptos para superficies en contacto directo con alimentos?', a: 'Sí. Tenemos línea específica de grado alimentario sin enjuague, aptos para mesadas, tablas de corte y utensilios. Proveemos la ficha técnica con la aprobación correspondiente.' },
    { q: '¿Qué desengrasante recomiendan para freidoras y hornos con mucha grasa acumulada?', a: 'Para grasa polimerizada y acumulada, recomendamos nuestro desengrasante alcalino concentrado. Se aplica en espuma, se deja actuar 10-15 minutos y se retira con agua a presión. Para mantenimiento regular, el desengrasante neutro es suficiente.' },
    { q: '¿Tienen documentación para presentar en auditorías del SENASA?', a: 'Sí. Todos nuestros productos tienen ficha técnica actualizada y hoja de seguridad. Para los productos de uso en industria alimentaria, proveemos certificados adicionales de apto alimentario.' },
    { q: '¿Cómo calculamos la cantidad de producto que necesitamos por mes?', a: 'Un asesor puede ayudarte con eso. Con algunos datos básicos (tamaño de la cocina, turnos de trabajo, tipo de cocina) podemos estimar el consumo mensual y armar un pedido ajustado a tu operación.' },
    { q: '¿Hacen muestras antes de comprar?', a: 'Sí. Para clientes nuevos podemos enviar muestras de los productos que te interesen para que los pruebes antes de comprometerte con un volumen mayor.' },
  ],
  blogSlugs: [
    { slug: 'desinfeccion-cocinas-industriales', title: 'Protocolos de desinfección en cocinas industriales: qué usar y cómo hacerlo bien' },
    { slug: 'limpieza-gastronomia-restaurantes-bares', title: 'Limpieza en gastronomía: protocolo completo para restaurantes y bares' },
    { slug: 'desinfeccion-industria-alimentaria-bebidas', title: 'Desinfección en la industria de alimentos y bebidas: guía práctica' },
  ],
  cta: '¿Por qué los restaurantes y cocinas industriales eligen FEMAVI?',
};

export default function Gastronomia() {
  return <VerticalPage v={config} />;
}
