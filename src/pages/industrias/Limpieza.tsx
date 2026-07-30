import { VerticalPage } from '../VerticalPage';
import type { VerticalConfig } from '../VerticalPage';

const config: VerticalConfig = {
  slug: 'limpieza',
  icon: '🧹',
  name: 'Empresas de Limpieza',
  heroTitle: 'Productos para empresas de limpieza profesional: alta concentración, máximo margen',
  heroDesc: 'Línea completa de productos de limpieza y desinfección de alta concentración para empresas de limpieza profesional, empresas de facility management y distribuidores. Precios mayoristas, entrega en 48 hs y fórmulas que rinden más para que vos ganes más.',
  seoTitle: 'Productos mayoristas para empresas de limpieza profesional | FEMAVI',
  seoDesc: 'Productos de limpieza de alta concentración para empresas de limpieza y facility management. Precios mayoristas, alta dilución, fichas técnicas. Entrega 48hs en AMBA.',
  keywords: 'productos para empresas de limpieza, insumos limpieza profesional mayorista, detergente concentrado para empresas, proveedor limpieza industrial Buenos Aires, productos alta dilución limpieza, mayorista productos limpieza Argentina',
  color: '#0067ac',
  products: [
    { name: 'Detergente Multiusos Ultra Concentrado', desc: 'El más usado por empresas de limpieza. Dilución hasta 1:100, un bidón de 20L rinde como 2000L de producto listo. Máximo margen por m² limpiado.' },
    { name: 'Desinfectante Amonio Cuaternario 4ª Gen.', desc: 'Bactericida, virucida y fungicida de amplio espectro. Para hospitales, escuelas, oficinas y cualquier superficie que requiera desinfección. Larga residualidad.' },
    { name: 'Cera Acrílica Autoemulsionable', desc: 'Para pisos de granito, mármol, cerámica y vinilo. Alto brillo, protección durable, fácil aplicación. El producto de recompra más frecuente de nuestros clientes.' },
    { name: 'Desengrasante Industrial Concentrado', desc: 'Para cocinas industriales, pisos con grasa, talleres y cualquier superficie con contaminación grasa. Alta potencia a precio competitivo.' },
    { name: 'Sanitizante para Baños', desc: 'Limpia y desinfecta sanitarios, azulejos y pisos de baño. Con desincrustante integrado para eliminar sarro y efecto bactericida prolongado.' },
    { name: 'Limpiador de Vidrios Profesional', desc: 'Para vidrios, espejos y superficies brillantes. Sin rayas, secado rápido, sin residuos. En formato concentrado para mayor rendimiento.' },
  ],
  benefits: [
    { icon: '💰', title: 'Precios mayoristas', desc: 'Precios diferenciados para empresas de limpieza y distribuidores. A mayor volumen, mejor precio. Posibilidad de contrato anual con precio fijo.' },
    { icon: '🔬', title: 'Alta concentración real', desc: 'No vendemos agua cara. Nuestros productos son genuinamente concentrados: las diluciones son las que decimos y el rendimiento es verificable.' },
    { icon: '📋', title: 'Documentación completa', desc: 'Fichas técnicas, SDS y certificados para cada producto. Esencial para presentar en clientes institucionales, licitaciones y auditorías.' },
    { icon: '⚡', title: 'Entrega confiable en 48 hs', desc: 'No podés quedar sin producto para un trabajo. Entregamos en 48 horas hábiles en AMBA con tracking del pedido.' },
    { icon: '🏷️', title: 'Marca blanca disponible', desc: 'Para empresas que quieren tener su propia marca, podemos envasar nuestros productos con tu etiqueta y logotipo.' },
    { icon: '🤝', title: 'Soporte técnico continuo', desc: 'Un equipo técnico disponible para recomendar productos, diluciones y protocolos para cada tipo de servicio que des.' },
  ],
  faq: [
    { q: '¿Cuál es el mínimo de compra para acceder a precios mayoristas?', a: 'Dependiendo del producto, los precios mayoristas aplican desde ciertos volúmenes mensuales. Contactanos para que un asesor te informe la escala de precios según tus volúmenes estimados.' },
    { q: '¿Pueden hacer marca blanca con nuestros productos?', a: 'Sí. Para clientes con volumen suficiente, podemos envasar nuestros productos con tu marca y diseño. Consultanos los requisitos mínimos de volumen para esta modalidad.' },
    { q: '¿Tienen todos los productos que necesito para cubrir distintos tipos de clientes?', a: 'Sí. Tenemos línea completa: desengrasantes, detergentes, ceras, desinfectantes, sanitizantes, limpiadores de vidrio, aromatizantes y productos especializados para distintos rubros. Podés cubrir todos tus servicios con un solo proveedor.' },
    { q: '¿Entregan en distintos puntos o solo en un lugar?', a: 'Podemos coordinar entregas en distintos puntos dentro del AMBA. Para distribuidores del interior, trabajamos con logística de terceros.' },
    { q: '¿Los productos tienen fichas técnicas para presentar en licitaciones?', a: 'Sí. Todos nuestros productos tienen ficha técnica completa, hoja de seguridad (SDS) en español y podemos emitir certificados adicionales si la licitación lo requiere.' },
  ],
  blogSlugs: [
    { slug: 'como-reducir-costos-limpieza-concentrados', title: 'Cómo reducir hasta un 40% el costo de limpieza con concentrados' },
    { slug: 'limpieza-pisos-industriales-cual-producto', title: 'Pisos industriales: ¿cera, desengrasante o detergente?' },
    { slug: 'limpieza-escuelas-colegios-instituciones-educativas', title: 'Limpieza en escuelas y colegios: guía completa' },
  ],
  cta: '¿Por qué las empresas de limpieza profesional eligen FEMAVI?',
};

export default function Limpieza() {
  return <VerticalPage v={config} />;
}
