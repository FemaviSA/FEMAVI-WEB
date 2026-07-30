import { VerticalPage } from '../VerticalPage';
import type { VerticalConfig } from '../VerticalPage';

const config: VerticalConfig = {
  slug: 'industria',
  icon: '🏭',
  name: 'Industria y Manufactura',
  heroTitle: 'Productos químicos industriales para manufactura, plantas y procesos productivos',
  heroDesc: 'Lubricantes, anticorrosivos, desengrasantes, desmoldantes, solventes dieléctricos y tratamiento de agua para plantas industriales y líneas de producción. Un solo proveedor para todas las necesidades de tu planta, con fórmulas de desarrollo propio.',
  seoTitle: 'Productos químicos industriales para manufactura y plantas | FEMAVI',
  seoDesc: 'Lubricantes, anticorrosivos, desengrasantes y desmoldantes para industria y manufactura. Fórmulas propias, fichas técnicas completas. Entrega 48hs. +50 años fabricando en Argentina.',
  keywords: 'anticorrosivo industrial, solvente dieléctrico, lubricante de corte, absorbente derrames industriales, desmoldante industrial, desengrasante para metales, productos químicos industriales Argentina, proveedor industria manufactura',
  color: '#0067ac',
  products: [
    { name: 'Aceites de Corte y Mecanizado', desc: 'Fluidos de corte y aceites solubles para tornería, fresado y rectificado. Reducen la temperatura, mejoran el acabado superficial y prolongan la vida de las herramientas.' },
    { name: 'Lubricantes Industriales ISO', desc: 'Aceites para reductores, engranajes, compresores y sistemas hidráulicos. Clasificación ISO VG disponible en todos los rangos. Fichas técnicas para cada aplicación.' },
    { name: 'Grasas Industriales', desc: 'Grasas de litio, litio complejo, bentonita y PTFE para rodamientos, articulaciones y maquinaria pesada. Resistentes a altas temperaturas y lavado.' },
    { name: 'Anticorrosivos y Protectores', desc: 'Para metales expuestos, almacenamiento de piezas, protección de estructuras y cavidades. Formulados para resistir humedad y ambientes agresivos.' },
    { name: 'Desengrasantes para Metales', desc: 'Desengrasantes industriales para piezas metálicas, moldes, matrices y equipos. En versiones con solvente, alcalinos y neutros según la aplicación.' },
    { name: 'Desmoldantes Industriales', desc: 'Para moldes de goma, plástico, hormigón y fundición. Facilitan el desmolde, protegen el molde y mejoran el acabado superficial de la pieza.' },
  ],
  benefits: [
    { icon: '🔬', title: 'Desarrollo propio', desc: 'Formulamos internamente con más de 50 años de experiencia. Podemos adaptar cualquier producto a las condiciones específicas de tu proceso.' },
    { icon: '📋', title: 'Fichas técnicas completas', desc: 'Hojas de seguridad (SDS), fichas técnicas y certificados de calidad para cada producto. Cumplimiento con normas ISO y requerimientos de auditoría.' },
    { icon: '🏭', title: 'Un solo proveedor', desc: 'Desde lubricantes hasta desengrasantes, desde desmoldantes hasta tratamiento de agua. Simplificás tu gestión de compras y reducís la cantidad de proveedores.' },
    { icon: '⚡', title: 'Entrega en 48 hs', desc: 'Despacho en 48 horas hábiles para todo el AMBA. Para plantas con demanda regular, podemos establecer un calendario de entregas.' },
    { icon: '💰', title: 'Precios por volumen', desc: 'Cuanto mayor es el volumen, mejor el precio. Negociamos contratos anuales con precio fijo y entregas programadas.' },
    { icon: '🤝', title: 'Soporte técnico', desc: 'Asesoramiento en la selección de lubricantes, diseño de planes de lubricación preventiva y evaluación de productos para procesos específicos.' },
  ],
  faq: [
    { q: '¿Pueden adaptar un lubricante a las condiciones específicas de mi maquinaria?', a: 'Sí. Con los datos técnicos de tu equipo (fabricante, temperatura de operación, velocidad, carga) podemos recomendar la viscosidad y los aditivos correctos, o formular un producto específico si el volumen lo justifica.' },
    { q: '¿Tienen aceites ISO para todas las viscosidades?', a: 'Sí. Cubrimos toda la gama ISO VG, desde VG 32 para compresores hasta VG 680 para engranajes de alta carga. Consultanos la disponibilidad de cada viscosidad.' },
    { q: '¿Sus productos tienen hojas de seguridad (SDS) actualizadas?', a: 'Sí. Todos nuestros productos tienen SDS en español, actualizadas según el sistema GHS/SGA. Las entregamos en el primer pedido y están disponibles para descarga.' },
    { q: '¿Pueden hacer entregas en plantas del interior del país?', a: 'Para el AMBA entregamos en 48 horas. Para el interior del país trabajamos con logística de terceros. Consultanos según la localidad y el volumen.' },
    { q: '¿Trabajan con órdenes de compra de empresas?', a: 'Sí. Operamos con órdenes de compra, facturas A o B según corresponda, y podemos adaptarnos a los procesos de compras de empresas medianas y grandes.' },
  ],
  blogSlugs: [
    { slug: 'lubricantes-iso-vs-sae-diferencias', title: 'Lubricantes ISO vs SAE: diferencias clave y cuándo usar cada norma' },
    { slug: 'lubricacion-preventiva-maquinas-industriales', title: 'Lubricación preventiva: cómo armar un plan para tu maquinaria' },
    { slug: 'anticorrosivos-proteccion-maquinaria-industrial', title: 'Anticorrosivos industriales: guía completa para maquinaria y estructuras' },
  ],
  cta: '¿Por qué las plantas industriales eligen FEMAVI?',
};

export default function Industria() {
  return <VerticalPage v={config} />;
}
