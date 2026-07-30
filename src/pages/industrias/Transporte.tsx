import { VerticalPage } from '../VerticalPage';
import type { VerticalConfig } from '../VerticalPage';

const config: VerticalConfig = {
  slug: 'transporte',
  icon: '🚌',
  name: 'Transporte y Flotas',
  heroTitle: 'Productos de limpieza y mantenimiento para flotas de transporte',
  heroDesc: 'Desengrasantes industriales, sanitizantes, ceras y lubricantes desarrollados para líneas de colectivos, flotas de camiones, trenes y vehículos de carga. Entrega en base. Rendimiento comprobado por las empresas de transporte más grandes del AMBA.',
  seoTitle: 'Productos de limpieza para transporte y flotas | FEMAVI',
  seoDesc: 'Desengrasantes, sanitizantes y lubricantes para flotas de colectivos, camiones y transporte de pasajeros. Entrega en 48hs en AMBA. +50 años fabricando en Argentina.',
  keywords: 'productos limpieza transporte pasajeros, desengrasante industrial colectivos, proveedor limpieza flotas, sanitizante flota colectivos, lubricante camiones, limpieza tren delantero, productos mantenimiento flota',
  color: '#0067ac',
  products: [
    { name: 'Desengrasante Industrial Concentrado', desc: 'Elimina grasa de motor, aceite de transmisión y suciedad pesada del tren delantero. Alta dilución, máximo rendimiento por litro.' },
    { name: 'Sanitizante para Habitáculo', desc: 'Desinfectante para el interior de vehículos: tapizados, pisos, manijas y superficies de contacto. Apto para uso en transporte de pasajeros.' },
    { name: 'Limpiador de Tapizados', desc: 'Elimina manchas orgánicas y de uso en tapizados de tela y vinilo. Sin residuos pegajosos, secado rápido.' },
    { name: 'Cera para Carrocerías', desc: 'Protección y brillo para carrocería. Facilita la limpieza posterior y protege la pintura de la exposición solar y la lluvia ácida.' },
    { name: 'Desengrasante para Motores', desc: 'Fórmula especial para limpieza de motores y compartimento de motor. Biodegradable, no daña cables ni mangueras.' },
    { name: 'Lubricante Multiusos', desc: 'Para bisagras, cerraduras, puertas y mecanismos de apertura. Penetra, lubrica y protege contra la corrosión.' },
  ],
  benefits: [
    { icon: '🚚', title: 'Entrega en base', desc: 'Coordinamos la entrega directamente en tu cochera o depósito, en el horario que mejor se adapte a tu operación.' },
    { icon: '💧', title: 'Alta concentración', desc: 'Nuestros productos rinden más por litro. Menos bidones, menos espacio de almacenaje, menor costo real por aplicación.' },
    { icon: '🔬', title: 'Desarrollo propio', desc: 'Formulamos internamente. Podemos adaptar concentraciones, fragancias y envases según el volumen y la necesidad de tu flota.' },
    { icon: '⚡', title: '48 hs de entrega', desc: 'Despachamos en 48 horas hábiles para todo el AMBA. Para pedidos grandes, coordinamos logística especial.' },
    { icon: '📋', title: 'Fichas técnicas y MSDS', desc: 'Documentación completa para auditorías y cumplimiento normativo. Todos nuestros productos tienen ficha de seguridad actualizada.' },
    { icon: '🤝', title: 'Atención postventa', desc: 'Un asesor técnico disponible para ayudarte con protocolos, diluciones y selección de productos para cada área de tu flota.' },
  ],
  faq: [
    { q: '¿Hacen entrega directamente en la cochera?', a: 'Sí. Coordinamos la entrega en tu cochera o depósito. Para flotas con compras recurrentes podemos establecer un calendario de entregas fijo.' },
    { q: '¿Qué desengrasante recomiendan para el tren delantero?', a: 'Para el tren delantero recomendamos nuestro desengrasante industrial concentrado, que disuelve grasa compactada, barro y aceite sin dañar gomas ni plásticos. Se aplica con hidrolavadora o aspersión.' },
    { q: '¿Tienen certificaciones para uso en transporte de pasajeros?', a: 'Sí, nuestros sanitizantes y desinfectantes para habitáculo cumplen con los requisitos de las normativas de higiene para transporte público. Proveemos la documentación necesaria para auditorías.' },
    { q: '¿Hacen precios por volumen?', a: 'Sí. A partir de ciertos volúmenes mensuales ofrecemos precios diferenciados. Contactanos para que un asesor arme un presupuesto específico para tu flota.' },
    { q: '¿Con qué frecuencia recomienden aplicar los productos?', a: 'Depende del tipo de producto y el uso del vehículo. Podemos ayudarte a diseñar un protocolo de limpieza completo adaptado a tu frecuencia de servicio y tipo de unidades.' },
  ],
  blogSlugs: [
    { slug: 'limpieza-flotas-transporte-colectivos', title: 'Limpieza y mantenimiento de flotas de colectivos: guía completa' },
    { slug: 'lubricacion-preventiva-maquinas-industriales', title: 'Lubricación preventiva: cómo proteger tu maquinaria' },
    { slug: 'anticorrosivos-proteccion-maquinaria-industrial', title: 'Anticorrosivos industriales: guía para proteger maquinaria' },
  ],
  cta: '¿Por qué las empresas de transporte eligen FEMAVI?',
};

export default function Transporte() {
  return <VerticalPage v={config} />;
}
