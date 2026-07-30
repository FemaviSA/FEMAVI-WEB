import { VerticalPage } from '../VerticalPage';
import type { VerticalConfig } from '../VerticalPage';

const config: VerticalConfig = {
  slug: 'edificios',
  icon: '🏢',
  name: 'Edificios y Consorcios',
  heroTitle: 'Productos de limpieza para edificios, consorcios y espacios corporativos',
  heroDesc: 'Ceras acrílicas, detergentes de alta dilución, desinfectantes y aromatizantes para administradores de edificios, empresas de facility management y consorcios. Precios mayoristas, entrega en 48 hs, y el respaldo de +50 años fabricando en Argentina.',
  seoTitle: 'Productos de limpieza para edificios y consorcios | FEMAVI',
  seoDesc: 'Ceras acrílicas, detergentes y desinfectantes para edificios, consorcios y facility management. Precios mayoristas, entrega 48hs en AMBA. Fabricación propia argentina.',
  keywords: 'cera acrílica pisos edificios, productos limpieza consorcios, detergente industrial edificios, limpieza facility management, productos higiene edificio corporativo, proveedor limpieza consorcios Argentina',
  color: '#0067ac',
  products: [
    { name: 'Cera Acrílica para Pisos', desc: 'Cera autoemulsionable de alto brillo para pisos de granito, mármol, cerámica y porcellanato. Forma una película protectora que facilita la limpieza y prolonga la vida del piso.' },
    { name: 'Detergente Multiusos Concentrado', desc: 'Para pisos, paredes y superficies en general. Alta dilución (hasta 1:100), un litro rinde lo que 100 litros del producto listo para usar.' },
    { name: 'Desinfectante Ambiental', desc: 'Desinfectante de amplio espectro para sanitarios, áreas comunes y cualquier superficie de alto contacto. Con fragancia agradable y larga residualidad.' },
    { name: 'Limpiador de Vidrios y Espejos', desc: 'Sin rayas, secado rápido, sin residuos. Para vidrios de fachada, espejos de ascensores y superficies vidriadas.' },
    { name: 'Aromatizante de Ambiente', desc: 'Aromatizantes en distintas fragancias para hall, ascensores y pasillos. Neutraliza olores en lugar de enmascararlos. Presentación en aerosol y líquido para difusor.' },
    { name: 'Desengrasante para Cocinas Comunes', desc: 'Para las cocinas comunes de edificios y espacios de cafetería. Elimina grasa de hornos, mesadas y freidoras.' },
  ],
  benefits: [
    { icon: '💰', title: 'Precios por volumen', desc: 'Cuanto más comprás, mejor precio. Ideal para administradoras que gestionan múltiples edificios o para presupuestos de consorcio anuales.' },
    { icon: '🏆', title: 'Rendimiento superior', desc: 'Nuestros productos concentrados rinden significativamente más que los equivalentes de supermercado. El costo real por m² limpio es menor.' },
    { icon: '📦', title: 'Stock siempre disponible', desc: 'Sin quiebres de stock. Entregas regulares para que el encargado nunca se quede sin producto.' },
    { icon: '🔬', title: 'Fórmula propia', desc: 'Desarrollamos nuestras fórmulas internamente. Podemos adaptar fragancia, concentración o envase según el edificio o la empresa.' },
    { icon: '⚡', title: 'Entrega en 48 hs', desc: 'Despacho en 48 horas hábiles para todo el AMBA. Para pedidos grandes, coordinamos logística especial.' },
    { icon: '📋', title: 'Fichas técnicas completas', desc: 'Para cumplimiento con reglamentaciones de PH y auditorías de administradores. Documentación siempre disponible.' },
  ],
  faq: [
    { q: '¿Qué cera recomiendan para pisos de granito?', a: 'Para granito recomendamos nuestra cera acrílica neutra, que protege sin alterar el color natural de la piedra. Para un brillo más intenso, existe la versión de alto brillo que se puede lustrar con máquina.' },
    { q: '¿Pueden entregar en el edificio directamente?', a: 'Sí. Coordinamos la entrega directamente en el edificio. El encargado puede recibir el pedido en el horario que más le convenga.' },
    { q: '¿Hacen precios especiales para administradoras con varios edificios?', a: 'Sí. Las administradoras que centralizan la compra para varios edificios acceden a precios de volumen significativamente mejores. Contactanos para armar una propuesta.' },
    { q: '¿Sus desinfectantes son seguros para usar en áreas con mascotas?', a: 'Sí, una vez secos. Durante la aplicación y el período de secado recomendamos que las mascotas no estén en el área tratada. Proveemos fichas de seguridad con información detallada.' },
    { q: '¿Tienen aromatizantes para diferentes ambientes?', a: 'Sí. Tenemos varios aromatizantes en distintas fragancias: cítrico, floral, neutro, bambú. Para edificios de categoría recomendamos los aromatizantes de larga duración para difusor, que dan una imagen más premium que el aerosol.' },
  ],
  blogSlugs: [
    { slug: 'limpieza-pisos-industriales-cual-producto', title: 'Pisos: ¿cera, desengrasante o detergente? Guía por tipo de piso' },
    { slug: 'limpieza-hoteleria-y-turismo', title: 'Limpieza profesional en hotelería: estándares y protocolos' },
    { slug: 'como-reducir-costos-limpieza-concentrados', title: 'Cómo reducir hasta un 40% el costo de limpieza con productos concentrados' },
  ],
  cta: '¿Por qué los administradores de edificios eligen FEMAVI?',
};

export default function Edificios() {
  return <VerticalPage v={config} />;
}
