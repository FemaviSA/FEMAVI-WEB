export type CategoryConfig = {
  slug: string;
  icon: string;
  name: string;
  /** Valores reales de la columna `subcategory` en la tabla products a incluir en esta página. */
  subcategories: string[];
  heroTitle: string;
  heroDesc: string;
  seoTitle: string;
  seoDesc: string;
  keywords: string;
  intro: string;
  benefits: { icon: string; title: string; desc: string }[];
  faq: { q: string; a: string }[];
  /** Tag usado para asociar posts de blog relacionados (ver content_topics / weekly-blog-post). */
  blogTag: string;
};

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    slug: 'desengrasantes',
    icon: '🧴',
    name: 'Desengrasantes',
    subcategories: ['Desengrasantes'],
    heroTitle: 'Desengrasante industrial concentrado, biodegradable y de alto rendimiento',
    heroDesc: 'Fórmulas propias para eliminar grasa carbonizada, aceite y suciedad pesada en metales, motores y piezas. Alta dilución, máximo rendimiento por litro. Fabricado en Argentina con entrega en 48hs.',
    // "piezas" viene de Search Console: "limpieza de piezas mecánicas" traía impresiones
    // pero cero clics, porque el título no usaba esa palabra. Ver comentario al pie.
    seoTitle: 'Desengrasante Industrial para Piezas y Metales — Argentina | FEMAVI',
    seoDesc: 'Desengrasantes industriales concentrados y biodegradables para limpieza de piezas mecánicas, metales y motores. Fórmula propia FEMAVI, venta por bidón o mayor, entrega en 48hs.',
    keywords: 'desengrasante industrial, desengrasante industrial Argentina, desengrasante industrial Buenos Aires, desengrasante para metales, desengrasante para piezas, desengrasante para motores, desengrasante biodegradable industrial, desengrasante concentrado por bidón, desengrasante por mayor',
    intro: 'Grasa carbonizada, aceite acumulado y suciedad industrial pesada necesitan una fórmula con verdadera capacidad de arrastre. Nuestros desengrasantes se desarrollan y fabrican internamente, ajustando concentración y pH según la superficie: metales, motores, pisos de taller o cocinas industriales.',
    benefits: [
      { icon: '💧', title: 'Alta concentración', desc: 'Diluciones de hasta 1:20 según la aplicación. Rinde más por litro, menos bidones, menor costo real.' },
      { icon: '🌱', title: 'Biodegradable', desc: 'Fórmulas pensadas para minimizar impacto ambiental sin resignar poder de desengrase.' },
      { icon: '🔬', title: 'Desarrollo propio', desc: 'Ajustamos concentración y presentación según el volumen y la superficie a tratar.' },
      { icon: '⚡', title: '48 hs de entrega', desc: 'Despachamos en 48 horas hábiles para todo el AMBA.' },
    ],
    faq: [
      { q: '¿Qué desengrasante conviene para piezas de motor?', a: 'Para motores y piezas mecánicas recomendamos nuestro desengrasante concentrado de alto poder de arrastre, que disuelve grasa carbonizada sin dañar gomas ni plásticos.' },
      { q: '¿Los desengrasantes son biodegradables?', a: 'Sí, nuestras fórmulas de desengrasante industrial están desarrolladas para ser biodegradables, cumpliendo con buenas prácticas ambientales.' },
      { q: '¿Venden por mayor o solo por bidón?', a: 'Vendemos desde bidones de 5L hasta tambores de 200L, con precios diferenciados por volumen para compras mayoristas.' },
    ],
    blogTag: 'desengrasantes',
  },
  {
    slug: 'higiene-industrial',
    icon: '🧼',
    name: 'Higiene y Limpieza Industrial',
    subcategories: ['Higiene Industrial', 'Limpiadores', 'Detergentes'],
    heroTitle: 'Productos de limpieza industrial para empresas y plantas de producción',
    heroDesc: 'Detergentes concentrados, limpiadores multiuso y productos de higiene industrial de desarrollo propio. Rendimiento profesional, compra por mayor, entrega en 48hs.',
    seoTitle: 'Productos de Limpieza Industrial Argentina | FEMAVI',
    seoDesc: 'Productos de limpieza e higiene industrial por mayor: detergentes concentrados, limpiadores multiuso y desinfectantes. Fabricante argentino, entrega en 48hs.',
    keywords: 'productos de limpieza industrial, limpieza industrial Argentina, productos de higiene industrial por mayor, desinfectante industrial concentrado, proveedor de productos de limpieza para empresas',
    intro: 'Simplificar el inventario de limpieza sin resignar resultado: nuestra línea de higiene industrial cubre detergentes de baldeo, limpiadores multiuso y productos de higiene concentrados, todos con ficha técnica y desarrollo propio.',
    benefits: [
      { icon: '💰', title: 'Precio mayorista', desc: 'Productos ultra concentrados con precios diferenciados para empresas de limpieza y compras por volumen.' },
      { icon: '🧽', title: 'Multiuso real', desc: 'Un producto, múltiples superficies. Menos variedad de bidones en el depósito.' },
      { icon: '📋', title: 'Ficha técnica y MSDS', desc: 'Documentación completa para auditorías y protocolos de higiene.' },
      { icon: '⚡', title: '48 hs de entrega', desc: 'Despachamos en 48 horas hábiles para todo el AMBA.' },
    ],
    faq: [
      { q: '¿Tienen productos para empresas de limpieza?', a: 'Sí, contamos con una línea de productos ultra concentrados pensada específicamente para empresas de limpieza, con precios mayoristas y entrega programada.' },
      { q: '¿Hacen productos a medida para higiene industrial?', a: 'Sí, formulamos internamente y podemos ajustar concentración, fragancia y presentación según la necesidad de tu planta o edificio.' },
    ],
    blogTag: 'higiene-industrial',
  },
  {
    slug: 'ceras-y-pisos',
    icon: '✨',
    name: 'Ceras y Mantenimiento de Pisos',
    subcategories: ['Ceras'],
    heroTitle: 'Cera acrílica industrial para pisos de alto tránsito',
    heroDesc: 'Ceras autobrillantes de alta resistencia para cerámicos, graníticos y cemento alisado. Brillo que dura semanas, no días, con menor costo por metro cuadrado.',
    seoTitle: 'Cera Acrílica Industrial para Pisos | FEMAVI',
    seoDesc: 'Cera acrílica para pisos de alto tránsito: cerámicos, graníticos y cemento alisado. Alta duración y brillo profesional. Fabricante argentino, entrega en 48hs.',
    keywords: 'cera acrílica industrial, cera para pisos de alto tránsito, cera acrílica para cerámicos, cera acrílica para graníticos, cera acrílica para cemento alisado, mantenimiento de pisos industriales',
    intro: 'Los facility managers de edificios corporativos y comercios piden nuestras ceras por nombre. Formulamos películas protectoras autobrillantes que resisten tránsito intenso, agua y productos de limpieza diaria sin perder brillo.',
    benefits: [
      { icon: '✨', title: 'Autobrillante', desc: 'No requiere lustradora industrial para mantener el brillo entre aplicaciones.' },
      { icon: '⏱️', title: 'Larga duración', desc: 'Un solo lustrado rinde hasta 3 semanas en pisos de alto tránsito.' },
      { icon: '🏢', title: 'Apta para todo tipo de piso', desc: 'Cerámicos, graníticos, cemento alisado y superficies porosas.' },
      { icon: '💲', title: 'Menor costo por m²', desc: 'Rendimiento superior que reduce la frecuencia de aplicación y el costo total.' },
    ],
    faq: [
      { q: '¿La cera acrílica sirve para cemento alisado?', a: 'Sí, nuestra cera acrílica premium es apta para cemento alisado, cerámicos y graníticos, formando una película protectora transparente.' },
      { q: '¿Cada cuánto hay que reaplicar la cera?', a: 'En pisos de alto tránsito el rendimiento típico es de hasta 3 semanas por aplicación, dependiendo del tránsito y la superficie.' },
    ],
    blogTag: 'ceras-y-pisos',
  },
  {
    slug: 'bactericidas',
    icon: '🦠',
    name: 'Bactericidas',
    subcategories: ['Desinfectantes'],
    heroTitle: 'Bactericida industrial de amplio espectro y acción residual',
    heroDesc: 'Desinfección profesional para superficies en contacto con alimentos, clínicas, centros de salud y plantas industriales. Fórmulas de cuarta generación con acción residual prolongada.',
    // El título arranca con "desinfectante" a propósito, aunque internamente la categoría
    // se llame "bactericida". Search Console mostró que la gente busca "desinfectante
    // industrial" y "desinfectantes en la industria alimentaria" (23 impresiones, CERO
    // clics): aparecíamos pero el título usaba otra palabra y no lo reconocían como
    // respuesta. Se mantienen ambos términos para no perder las búsquedas por bactericida.
    seoTitle: 'Desinfectante y Bactericida Industrial — Industria Alimentaria | FEMAVI',
    seoDesc: 'Desinfectante bactericida industrial concentrado para industria alimentaria, cocinas y plantas. Amplio espectro y acción residual. Fabricante argentino, entrega en 48hs.',
    keywords: 'desinfectante industrial, desinfectantes en la industria alimentaria, bactericida industrial, bactericida para eliminar malos olores, desinfectante bactericida concentrado, bactericida para industria alimentaria',
    intro: 'Una sola fórmula que desinfecta cocinas, cámaras frigoríficas, clínicas y áreas de servicio sin cambiar de producto. Nuestros bactericidas eliminan bacterias, hongos y levaduras con acción residual prolongada.',
    benefits: [
      { icon: '🍽️', title: 'Apto industria alimenticia', desc: 'Cumple los requisitos para superficies en contacto con alimentos.' },
      { icon: '⏳', title: 'Acción residual', desc: 'Protección prolongada más allá de la aplicación inicial.' },
      { icon: '🔬', title: 'Amplio espectro', desc: 'Elimina bacterias, hongos y levaduras en una sola fórmula.' },
      { icon: '📋', title: 'Documentación completa', desc: 'Fichas técnicas y de seguridad para auditorías y protocolos exigentes.' },
    ],
    faq: [
      { q: '¿El bactericida es apto para cocinas industriales?', a: 'Sí, nuestros bactericidas cumplen los requisitos para superficies en contacto con alimentos en cocinas industriales y plantas alimenticias.' },
      { q: '¿Elimina malos olores además de bacterias?', a: 'Sí, al eliminar la carga bacteriana que genera el mal olor en su origen, en lugar de enmascararlo.' },
    ],
    blogTag: 'bactericidas',
  },
  {
    slug: 'anticorrosivos',
    icon: '🛡️',
    name: 'Anticorrosivos',
    subcategories: ['Anticorrosivos'],
    heroTitle: 'Anticorrosivo industrial para metales, maquinaria y estructuras',
    heroDesc: 'Protección anticorrosiva de larga duración para piezas metálicas, maquinaria y estructuras. Fórmulas de película seca o grasa, sin residuo pegajoso, para talleres y plantas industriales.',
    seoTitle: 'Anticorrosivo Industrial para Metales y Maquinaria | FEMAVI',
    seoDesc: 'Anticorrosivo industrial para metales, maquinaria y estructuras metálicas. Protección de larga duración, fabricante argentino, entrega en 48hs.',
    keywords: 'anticorrosivo industrial, protección anticorrosiva para metales, anticorrosivo para maquinaria, anticorrosivo para estructuras metálicas',
    intro: 'Piezas mecanizadas, herramientas y estructuras metálicas expuestas a humedad necesitan protección real contra la oxidación. Nuestros anticorrosivos protegen sin manchar y sin dejar residuo graso, ideales para almacenaje prolongado.',
    benefits: [
      { icon: '🛡️', title: 'Protección de larga duración', desc: 'Película protectora que resiste semanas de almacenaje sin oxidación.' },
      { icon: '🔩', title: 'Para piezas de precisión', desc: 'No daña tolerancias ni terminaciones de piezas mecanizadas.' },
      { icon: '🏭', title: 'Uso en maquinaria y estructuras', desc: 'Aplicable en equipos, estructuras metálicas y componentes de talleres.' },
      { icon: '⚡', title: '48 hs de entrega', desc: 'Despachamos en 48 horas hábiles para todo el AMBA.' },
    ],
    faq: [
      { q: '¿El anticorrosivo deja residuo graso?', a: 'No, nuestras fórmulas de película seca protegen sin dejar un residuo graso que ensucie o requiera limpieza posterior.' },
      { q: '¿Sirve para almacenar piezas mecanizadas por semanas?', a: 'Sí, es una de sus aplicaciones principales: proteger piezas de precisión durante el almacenaje prolongado sin riesgo de oxidación.' },
    ],
    blogTag: 'anticorrosivos',
  },
  {
    slug: 'lubricantes',
    icon: '⚙️',
    name: 'Lubricantes',
    subcategories: ['Lubricantes', 'Grasas', 'Aceites y Aditivos'],
    heroTitle: 'Lubricantes industriales especiales de desarrollo propio',
    heroDesc: 'Lubricantes, grasas y aceites para mantenimiento industrial, maquinaria y mecanismos de precisión. Fórmulas propias para necesidades que los lubricantes genéricos no resuelven.',
    seoTitle: 'Lubricantes Industriales Especiales | FEMAVI',
    seoDesc: 'Lubricantes industriales, grasas y aceites de fórmula propia para mantenimiento industrial. Fabricante argentino con más de 50 años, entrega en 48hs.',
    keywords: 'lubricantes industriales especiales, lubricante para mantenimiento industrial, grasa lubricante industrial por mayor',
    intro: 'Cuando un lubricante genérico no alcanza, desarrollamos internamente fórmulas específicas: grasas de alta temperatura, aceites de corte y lubricantes multiuso para mecanismos, cadenas y maquinaria de producción.',
    benefits: [
      { icon: '🔬', title: 'Fórmula a medida', desc: 'Ajustamos viscosidad y aditivos según la maquinaria y condición de trabajo.' },
      { icon: '⚙️', title: 'Para mantenimiento industrial', desc: 'Lubricación preventiva de mecanismos, cadenas, rodamientos y guías.' },
      { icon: '💧', title: 'Distribuidores OKS', desc: 'Además de nuestra línea propia, distribuimos oficialmente productos OKS.' },
      { icon: '⚡', title: '48 hs de entrega', desc: 'Despachamos en 48 horas hábiles para todo el AMBA.' },
    ],
    faq: [
      { q: '¿Hacen lubricantes a medida?', a: 'Sí, formulamos internamente y podemos ajustar viscosidad, aditivos y presentación según el equipo y la aplicación.' },
      { q: '¿Tienen grasas para alta temperatura?', a: 'Sí, contamos con grasas industriales para distintas condiciones de temperatura y carga. Consultanos por la aplicación específica.' },
    ],
    blogTag: 'lubricantes',
  },
  // Las tres de abajo se agregaron el 18-08-2026. Antes, 44 de los 199 productos vivían en
  // subcategorías sin página propia: solo se llegaba a ellos desde /catalogo o buscando, y
  // no había ninguna página que pudiera rankear por el término del rubro. Estas tres cubren
  // 33 de esos 44. Quedan sin página Lavamanos (5), Insecticida (3) y Tratamiento para
  // Aguas (3), que por volumen no justifican una categoría todavía.
  {
    slug: 'aerosoles',
    icon: '💨',
    name: 'Aerosoles Industriales',
    subcategories: ['Aerosoles'],
    heroTitle: 'Aerosoles industriales para lubricación, penetración y limpieza de precisión',
    heroDesc: 'Lubricantes con MoS₂, penetrantes desoxidantes, siliconas, desmoldantes y limpiadores de electrónica en formato aerosol. Aplicación puntual, sin desperdicio y sin herramientas. Fabricación propia, entrega en 48hs.',
    seoTitle: 'Aerosoles Industriales: lubricantes y penetrantes | FEMAVI',
    seoDesc: 'Aerosoles industriales de fabricación propia: lubricantes con MoS₂, penetrantes desoxidantes, siliconas, desmoldantes y limpiador de electrónica. Caja x 12, entrega en 48hs.',
    keywords: 'aerosoles industriales, aerosol lubricante, aerosol penetrante desoxidante, aerosol de silicona, grasa en aerosol, limpiador de contactos electrónicos, aerosol desmoldante, aerosoles industriales Argentina',
    intro: 'El aerosol resuelve lo que el bidón no: llegar a un punto exacto, sin desarmar el equipo y sin desperdiciar producto. La línea cubre lubricación de cadenas y rodamientos, liberación de tuercas oxidadas, protección de contactores eléctricos, desmoldeo y limpieza de componentes electrónicos.',
    benefits: [
      { icon: '🎯', title: 'Aplicación puntual', desc: 'Llega a cadenas, guías y rodamientos sin desarmar el equipo ni recurrir a pincel o aceitera.' },
      { icon: '⚙️', title: 'Aditivados', desc: 'Fórmulas con MoS₂ y grafito para carga y temperatura, no simples lubricantes de uso general.' },
      { icon: '🔌', title: 'Aptos para electrónica', desc: 'Limpiadores dieléctricos que evaporan sin dejar residuo sobre placas y contactores.' },
      { icon: '📦', title: 'Caja x 12', desc: 'Se venden por caja cerrada, con precio diferenciado para consumo de planta.' },
    ],
    faq: [
      { q: '¿Qué aerosol sirve para aflojar tuercas oxidadas?', a: 'El penetrante desoxidante está formulado para infiltrarse en el óxido y liberar uniones trabadas: tuercas, tornillos y bulones tomados por la corrosión.' },
      { q: '¿Tienen algún aerosol apto para componentes electrónicos?', a: 'Sí. Contamos con un limpiador desengrasante dieléctrico que evapora rápido y no deja residuo, pensado para placas, contactores y tableros.' },
      { q: '¿Se venden por unidad o por caja?', a: 'La presentación es caja por 12 unidades, con precio diferenciado por volumen para consumo de planta o reventa.' },
    ],
    blogTag: 'aerosoles',
  },
  {
    slug: 'linea-automotor',
    icon: '🚗',
    name: 'Línea Automotor',
    subcategories: ['Línea Automotor'],
    heroTitle: 'Productos para lavadero de autos, taller y mantenimiento de flotas',
    heroDesc: 'Shampoo teflonado, encerantes de carrocería, revividores de interior y gomas, desengrasante de motores y anticongelante. Fórmulas propias para lavaderos, talleres y flotas. Entrega en 48hs.',
    seoTitle: 'Productos para Lavadero de Autos y Taller | FEMAVI',
    seoDesc: 'Shampoo para autos, encerante de carrocerías, revividor de interiores y gomas, limpiador de motores y anticongelante. Fabricante argentino, venta por bidón y por mayor.',
    keywords: 'productos para lavadero de autos, shampoo para autos por mayor, encerante de carrocerias, revividor de gomas, limpiador de motores, anticongelante para radiadores, productos automotor por mayor Argentina',
    intro: 'Un lavadero o un taller necesita resultado visible y costo por vehículo bajo. La línea cubre el ciclo completo: lavado con shampoo teflonado, desengrase de motor, encerado de carrocería y recuperación de plásticos y gomas del interior.',
    benefits: [
      { icon: '✨', title: 'Resultado a la vista', desc: 'Ceras de alto punto de fusión y siliconas que devuelven el brillo y el negro original.' },
      { icon: '🚚', title: 'Pensada para flotas', desc: 'La usan lavaderos y talleres que procesan decenas de unidades por día, no un auto por fin de semana.' },
      { icon: '💧', title: 'Concentrados', desc: 'Se diluyen: el costo por vehículo lavado queda muy por debajo del producto listo para usar.' },
      { icon: '🛢️', title: 'De 10 a 200 litros', desc: 'Desde el bidón para el taller chico hasta el tambor para la flota.' },
    ],
    faq: [
      { q: '¿El shampoo para autos sirve para lavadero de alto volumen?', a: 'Sí. Es un shampoo teflonado concentrado, con agentes protectores que abrillantan; al diluirse, el costo por unidad lavada es bajo. Se entrega desde 10 hasta 200 litros.' },
      { q: '¿Qué usan para limpiar motores?', a: 'Un limpiador desengrasante específico para motores, que disuelve grasa y aceite acumulado sin atacar gomas ni plásticos del compartimento.' },
      { q: '¿Venden a lavaderos y talleres por mayor?', a: 'Sí, la venta es a empresas por cotización, con precio diferenciado por volumen. Se pide presupuesto y responde el equipo comercial.' },
    ],
    blogTag: 'automotor',
  },
  {
    slug: 'desmoldantes',
    icon: '🧱',
    name: 'Desmoldantes y Antiadherentes',
    subcategories: ['Desmoldantes'],
    heroTitle: 'Desmoldantes y antiadherentes para hormigón, caucho, plástico y panadería',
    heroDesc: 'Agentes de desmoldeo para encofrado de hormigón, prensas, rotomoldeado, caucho y moldes de panadería. Con lubricantes y anticorrosivos incorporados. Fórmulas propias, entrega en 48hs.',
    seoTitle: 'Desmoldante Industrial para Hormigón y Caucho | FEMAVI',
    seoDesc: 'Desmoldantes para encofrado de hormigón, prensas, rotomoldeado, caucho y panadería. Con y sin silicona, solubles en agua y en pasta. Fabricante argentino, entrega en 48hs.',
    keywords: 'desmoldante industrial, desmoldante para hormigon, desmoldante para encofrado, desmoldante para caucho, desmoldante para rotomoldeado, antiadherente de panaderia, desmoldante sin silicona, agente desmoldante Argentina',
    intro: 'Un desmoldeo que falla arruina la pieza y el molde. La línea cubre desde el encofrado de hormigón —con anticorrosivos para proteger el metal— hasta el rotomoldeado, el caucho, el corte de madera y los moldes de panadería que trabajan a alta temperatura.',
    benefits: [
      { icon: '🧱', title: 'Para cada material', desc: 'Fórmulas distintas para hormigón, caucho, plástico, madera y panadería: no es un producto único forzado a todo.' },
      { icon: '🛡️', title: 'Protegen el molde', desc: 'El desmoldante de hormigón lleva anticorrosivos y lubricantes que cuidan el encofrado metálico.' },
      { icon: '🚫', title: 'Con y sin silicona', desc: 'Versión libre de silicona para piezas que después se pintan o se pegan.' },
      { icon: '🔥', title: 'Alta temperatura', desc: 'Antiadherentes que aguantan la temperatura de horno en panadería industrial.' },
    ],
    faq: [
      { q: '¿Qué desmoldante se usa para encofrado de hormigón?', a: 'El desmoldante para hormigón, formulado con anticorrosivos y lubricantes: además de liberar la pieza, protege el encofrado metálico de la corrosión.' },
      { q: '¿Tienen desmoldante sin silicona?', a: 'Sí. Hay una versión libre de silicona y antiadherente, indicada cuando la pieza se pinta, se pega o se suelda después del desmoldeo.' },
      { q: '¿Sirve alguno para moldes de panadería?', a: 'Sí, contamos con un antiadherente para alta temperatura específico para moldes de panadería industrial.' },
    ],
    blogTag: 'desmoldantes',
  },
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATEGORY_CONFIGS.find(c => c.slug === slug);
}

export function findCategoryConfigBySubcategory(subcategory: string | null | undefined): CategoryConfig | undefined {
  if (!subcategory) return undefined;
  return CATEGORY_CONFIGS.find(c => c.subcategories.includes(subcategory));
}
