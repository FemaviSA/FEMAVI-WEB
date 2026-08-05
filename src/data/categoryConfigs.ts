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
    seoTitle: 'Desengrasante Industrial en Argentina | FEMAVI',
    seoDesc: 'Desengrasantes industriales concentrados y biodegradables para metales, motores y piezas. Fórmula propia FEMAVI, venta por bidón o mayor, entrega en 48hs.',
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
    seoTitle: 'Bactericida Industrial de Amplio Espectro | FEMAVI',
    seoDesc: 'Bactericida industrial concentrado, apto para industria alimenticia, con acción residual y amplio espectro. Fabricante argentino, entrega en 48hs.',
    keywords: 'bactericida industrial, bactericida para eliminar malos olores, desinfectante bactericida concentrado, bactericida para industria alimentaria',
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
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATEGORY_CONFIGS.find(c => c.slug === slug);
}

export function findCategoryConfigBySubcategory(subcategory: string | null | undefined): CategoryConfig | undefined {
  if (!subcategory) return undefined;
  return CATEGORY_CONFIGS.find(c => c.subcategories.includes(subcategory));
}
