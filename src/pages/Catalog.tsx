import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { setCartMode } from '../lib/cartMode';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { SEO, SITE_URL } from '../components/SEO';
import { CATEGORY_CONFIGS } from '../data/categoryConfigs';
import type { Product } from '../types/product';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', textLight: '#8899a8',
  borderLight: '#e2e8ee', whatsapp: '#25D366',
};

const INDUSTRIES = [
  { id: 'all', label: 'Todos', icon: '📦', seoTitle: '', seoDesc: '' },
  { id: 'Transporte', label: 'Transporte', icon: '🚌', seoTitle: 'Productos de Limpieza Industrial para Transporte de Pasajeros', seoDesc: 'Desengrasantes, sanitizantes y limpiadores industriales para flotas de colectivos y transporte.' },
  { id: 'Gastronomía', label: 'Gastronomía', icon: '🍳', seoTitle: 'Productos Químicos para Gastronomía e Industria Alimenticia', seoDesc: 'Bactericidas, aceites alimenticios y desengrasantes aptos para contacto con alimentos.' },
  { id: 'Edificios', label: 'Edificios', icon: '🏢', seoTitle: 'Productos de Limpieza para Edificios y Consorcios', seoDesc: 'Ceras, detergentes y aromatizantes profesionales para edificios corporativos.' },
  { id: 'Industria', label: 'Industria', icon: '⚙️', seoTitle: 'Productos Químicos para Industria y Manufactura', seoDesc: 'Lubricantes, anticorrosivos, solventes y absorbentes para producción industrial.' },
  { id: 'Automotor', label: 'Automotor', icon: '🚗', seoTitle: 'Productos para Talleres Mecánicos y Línea Automotor', seoDesc: 'Anticorrosivos, lavamanos y lubricantes para talleres mecánicos.' },
  { id: 'Comercios', label: 'Comercios', icon: '🏪', seoTitle: 'Productos de Limpieza Profesional para Comercios', seoDesc: 'Ceras, aromatizantes y detergentes para locales comerciales.' },
  { id: 'Salud', label: 'Salud', icon: '🏥', seoTitle: 'Productos de Desinfección para Salud', seoDesc: 'Bactericidas de amplio espectro para clínicas y centros de salud.' },
  { id: 'Empresas de limpieza', label: 'Empresas de limpieza', icon: '🧹', seoTitle: 'Productos Mayoristas para Empresas de Limpieza', seoDesc: 'Productos concentrados con máximo rendimiento para limpieza profesional.' },
  { id: 'Hogar e Institucional', label: 'Hogar e Institucional', icon: '🏠', seoTitle: 'Línea Daurange — Productos para Hogar e Institucional', seoDesc: 'Limpiadores, desinfectantes, aromatizantes y productos de higiene para uso doméstico e institucional.' },
];

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  Transporte: ['transporte'],
  Gastronomía: ['gastronomía', 'hotelería'],
  Edificios: ['edificios', 'consorcios'],
  Industria: ['industria', 'industrial', 'metalúrgica', 'manufactura', 'minería', 'minera', 'construcción', 'química', 'eléctrica', 'electrónica', 'energía', 'maquinaria', 'naval', 'textil', 'vidrio', 'gráfica', 'farmacéutica', 'plástico', 'bebidas', 'aeronáutica', 'maderera'],
  Automotor: ['automotriz', 'automotor', 'mecánicos', 'mecanizados', 'rectificadoras'],
  Comercios: ['institucional', 'entretenimiento', 'comercio'],
  Salud: ['salud', 'sanidad'],
  'Empresas de limpieza': ['limpieza'],
  'Hogar e Institucional': ['hogar'],
};

function useInView(t = 0.1): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: t });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, [t]);
  return [ref, v];
}

function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const [ref, v] = useInView();
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(20px)', transition: `all 0.55s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 20, height: 2, background: C.accent, borderRadius: 1 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
    </div>
  );
}

function FilterBadge({ children, active, onClick, size = 'md' }: { children: React.ReactNode; active: boolean; onClick: () => void; size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? '6px 14px' : '9px 18px';
  const fs = size === 'sm' ? 12 : 13;
  return (
    <button
      onClick={onClick}
      style={{
        padding: pad, background: active ? C.accent : C.white, color: active ? C.white : C.text,
        fontSize: fs, fontWeight: 600, borderRadius: 100,
        border: `1px solid ${active ? C.accent : C.borderLight}`, cursor: 'pointer',
        transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif",
        boxShadow: active ? '0 2px 12px rgba(0,103,172,0.25)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function IndustryHero({ industry, products }: { industry: typeof INDUSTRIES[number] | undefined; products: Product[] }) {
  if (!industry || industry.id === 'all') return null;
  const count = products.filter(p => p.industries.includes(industry.id)).length;
  const data: Record<string, { sub: string; stats: [string, string][] }> = {
    'Transporte': { sub: 'Más de 200 flotas de colectivos en AMBA confían en nuestras fórmulas. Desengrasantes de motor, sanitizantes, limpiadores de tapizado y mantenimiento general con entrega en 48 horas.', stats: [['200+', 'Flotas'], ['48hs', 'Entrega'], [`${count}`, 'Productos']] },
    'Gastronomía': { sub: 'Fórmulas aptas para superficies en contacto con alimentos. Bactericidas certificados, aceites grado alimenticio y desengrasantes de cocina industrial.', stats: [['100%', 'Apto alimentos'], ['ANMAT', 'Cumplimiento'], [`${count}`, 'Productos']] },
    'Edificios': { sub: 'Ceras que duran semanas, detergentes x5 rendimiento y aromatizantes que piden por nombre. Menor costo por metro cuadrado sin resignar resultado.', stats: [['3x', 'Menor costo/m²'], ['48hs', 'Entrega'], [`${count}`, 'Productos']] },
    'Industria': { sub: 'Lubricantes de corte, anticorrosivos, solventes dieléctricos y absorbentes. Todo lo que una planta necesita para producción, mantenimiento y seguridad.', stats: [['50+', 'Años'], ['200+', 'Plantas'], [`${count}`, 'Productos']] },
    'Automotor': { sub: 'Anticorrosivos, lavamanos industrial, lubricantes y absorbentes para talleres que trabajan en serio.', stats: [['500+', 'Talleres'], ['48hs', 'Entrega'], [`${count}`, 'Productos']] },
    'Comercios': { sub: 'Ceras autobrillantes, aromatizantes de larga duración y detergentes concentrados de rendimiento profesional.', stats: [['10x', 'Rendimiento'], ['48hs', 'Entrega'], [`${count}`, 'Productos']] },
    'Salud': { sub: 'Bactericidas de amplio espectro con acción residual para clínicas y centros de salud. Protocolos de desinfección exigentes.', stats: [['99.9%', 'Eliminación'], ['Certificado', 'Espectro'], [`${count}`, 'Productos']] },
    'Empresas de limpieza': { sub: 'Línea completa de productos ultra concentrados. Precios mayoristas, entrega programada, máximo margen por metro cuadrado.', stats: [['40%', 'Ahorro'], ['Nacional', 'Envío'], [`${count}`, 'Productos']] },
    'Hogar e Institucional': { sub: 'Línea Daurange: productos de limpieza, higiene y cuidado para uso doméstico e institucional. Fórmulas de calidad profesional accesibles para el consumidor final.', stats: [['Línea', 'Daurange'], ['Uso diario', 'Hogar'], [`${count}`, 'Productos']] },
  };
  const d = data[industry.id];
  if (!d) return null;
  return (
    <FadeIn>
      <div style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, borderRadius: 20, padding: '44px 52px', marginBottom: 36, position: 'relative', overflow: 'hidden', color: C.white }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 44, display: 'block', marginBottom: 10 }}>{industry.icon}</span>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 800, margin: '0 0 10px', maxWidth: 540 }}>{industry.seoTitle}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85, margin: '0 0 28px', maxWidth: 580 }}>{d.sub}</p>
          <div style={{ display: 'flex', gap: 40 }}>
            {d.stats.map(([n, l]) => (
              <div key={l}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{n}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

const CATEGORIES = [
  'Todos',
  'Higiene Industrial',
  'Producción',
  'Aceites y Lubricantes',
  'Grasas',
  'Aerosoles',
  'Tratamiento de Agua',
  'Papel',
  'Línea Daurange',
];

const SUBCATEGORIES = [
  'Aceites y Aditivos',
  'Aerosoles',
  'Anticorrosivos',
  'Ceras',
  'Desengrasantes',
  'Desinfectantes',
  'Desmoldantes',
  'Detergentes',
  'Grasas',
  'Higiene Industrial',
  'Insecticida',
  'Lavamanos',
  'Limpiadores',
  'Línea Automotor',
  'Lubricantes',
  'Tratamiento para Aguas',
];

export default function Catalog() {
  const { products, loading } = useProducts();
  const [searchParams] = useSearchParams();
  const [activeIndustry, setActiveIndustry] = useState(() => {
    const ind = searchParams.get('industria');
    return ind && INDUSTRIES.some(i => i.id === ind) ? ind : 'all';
  });
  const [activeCategory, setActiveCategory] = useState(() => {
    const cat = searchParams.get('categoria');
    return cat && CATEGORIES.includes(cat) ? cat : 'Todos';
  });
  const [activeSubcategory, setActiveSubcategory] = useState(() => {
    const sub = searchParams.get('tipo');
    return sub && SUBCATEGORIES.includes(sub) ? sub : 'Todos';
  });
  const [activeBenefits, setActiveBenefits] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    document.body.style.background = C.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  const filtered = useMemo(() => {
    let r = products;
    if (activeCategory !== 'Todos') r = r.filter(p => p.category === activeCategory);
    if (activeSubcategory !== 'Todos') r = r.filter(p => p.subcategory === activeSubcategory);
    if (activeIndustry !== 'all') {
      const keywords = INDUSTRY_KEYWORDS[activeIndustry] ?? [];
      r = r.filter(p => p.industries.some(ind => keywords.some(kw => ind.toLowerCase().includes(kw))));
    }
    if (activeBenefits.length > 0) r = r.filter(p => activeBenefits.some(b => p.benefits.includes(b)));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.headline ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [products, activeCategory, activeSubcategory, activeIndustry, activeBenefits, searchQuery]);

  const catalogJsonLd = useMemo(() => {
    const list = products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/catalogo/${p.slug}`,
      name: p.name,
    }));
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/catalogo#webpage`,
        url: `${SITE_URL}/catalogo`,
        name: 'Catálogo de productos químicos industriales — FEMAVI',
        description: 'Catálogo completo de productos químicos industriales FEMAVI: desengrasantes, bactericidas, ceras, lubricantes, anticorrosivos.',
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE_URL}/catalogo` },
          ],
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Productos químicos industriales',
        numberOfItems: products.length,
        itemListElement: list,
      },
    ];
  }, [products]);

  return (
    <>
      <SEO
        title="Catálogo de productos químicos industriales — FEMAVI"
        description="Catálogo completo: desengrasantes, bactericidas, ceras acrílicas, lubricantes, aerosoles, anticorrosivos. Fórmulas de desarrollo propio FEMAVI con ficha técnica y pedidos en 48 hs."
        canonical={SITE_URL + '/catalogo'}
        jsonLd={catalogJsonLd}
      />
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: scrolled ? 'rgba(255,255,255,0.97)' : C.white, backdropFilter: 'blur(16px)', borderBottom: `1px solid ${C.borderLight}`, transition: 'all 0.3s', boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.04)' : 'none' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: scrolled ? 56 : 68 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 48, width: 'auto' }} />
          </Link>
          <div className="desktop-nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <span style={{ color: C.accent, fontSize: 14, fontWeight: 700 }}>Catálogo</span>
            <Link to="/#soluciones" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Soluciones</Link>
            <Link to="/nosotros" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Nosotros</Link>
            <Link to="/#cotizar" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Contacto</Link>
            <button onClick={() => { setCartMode('pedido'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '10px 22px', background: 'transparent', color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 8, border: `1.5px solid ${C.borderLight}`, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Hacer mi pedido</button>
            <button onClick={() => { setCartMode('cotizacion'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '10px 22px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Pedir Cotización</button>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen((o: boolean) => !o)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'block', width: 24, height: 2, background: C.dark, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
            <span style={{ display: 'block', width: 24, height: 2, background: C.dark, borderRadius: 2, opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 24, height: 2, background: C.dark, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
          </button>
        </div>
        {menuOpen && (
          <div style={{ background: C.white, borderTop: `1px solid ${C.borderLight}`, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ color: C.accent, fontSize: 15, fontWeight: 700 }}>Catálogo</span>
            <Link to="/#soluciones" onClick={() => setMenuOpen(false)} style={{ color: C.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Soluciones</Link>
            <Link to="/nosotros" onClick={() => setMenuOpen(false)} style={{ color: C.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Nosotros</Link>
            <Link to="/#cotizar" onClick={() => setMenuOpen(false)} style={{ color: C.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Contacto</Link>
            <button onClick={() => { setCartMode('pedido'); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '12px 24px', border: `1.5px solid ${C.borderLight}`, color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>Hacer mi pedido</button>
            <button onClick={() => { setCartMode('cotizacion'); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '12px 24px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>Pedir Cotización</button>
          </div>
        )}
      </nav>

      <section style={{ paddingTop: 120, paddingBottom: 48, background: `linear-gradient(170deg, ${C.white} 0%, ${C.bg} 100%)`, position: 'relative' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <FadeIn>
            <SectionLabel>Catálogo de productos</SectionLabel>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 48, fontWeight: 800, color: C.dark, letterSpacing: '-0.03em', margin: '0 0 12px', lineHeight: 1.1 }}>
              Más de 100 fórmulas<br /><span style={{ color: C.accent }}>de desarrollo propio.</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: C.textMuted, maxWidth: 520, margin: '0 0 28px' }}>
              Filtrá por categoría, tipo de producto, industria o nombre. Cada producto tiene ficha técnica y cotización directa.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div style={{ position: 'relative', maxWidth: 480 }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: C.textLight }}>🔍</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, tipo o aplicación..."
                style={{ width: '100%', padding: '14px 18px 14px 44px', background: C.white, border: `1px solid ${C.borderLight}`, borderRadius: 12, color: C.text, fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}
              />
            </div>
          </FadeIn>
        </div>
      </section>

      <section style={{ background: C.bg, paddingBottom: 100 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
          <FadeIn>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Por categoría</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <FilterBadge key={cat} active={activeCategory === cat} onClick={() => { setActiveCategory(cat); setActiveSubcategory('Todos'); setActiveIndustry('all'); setActiveBenefits([]); }}>
                    {cat}
                  </FilterBadge>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Por tipo de producto</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <FilterBadge active={activeSubcategory === 'Todos'} onClick={() => setActiveSubcategory('Todos')}>
                  Todos
                </FilterBadge>
                {SUBCATEGORIES.map(sub => (
                  <FilterBadge key={sub} active={activeSubcategory === sub} onClick={() => setActiveSubcategory(sub)}>
                    {sub}
                  </FilterBadge>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Por industria</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {INDUSTRIES.map(ind => (
                  <FilterBadge key={ind.id} active={activeIndustry === ind.id} onClick={() => { setActiveIndustry(ind.id); setActiveBenefits([]); setActiveCategory('Todos'); }}>
                    <span>{ind.icon}</span> {ind.label}
                  </FilterBadge>
                ))}
              </div>
            </div>
          </FadeIn>
          <IndustryHero industry={INDUSTRIES.find(i => i.id === activeIndustry)} products={products} />

          {(() => {
            const activeCategoryConfig = activeSubcategory !== 'Todos'
              ? CATEGORY_CONFIGS.find(c => c.subcategories.includes(activeSubcategory))
              : undefined;
            if (!activeCategoryConfig) return null;
            return (
              <div style={{ marginBottom: 16 }}>
                <Link
                  to={`/catalogo/categoria/${activeCategoryConfig.slug}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.accentPale, color: C.accent, borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                >
                  Ver página completa de {activeCategoryConfig.name} →
                </Link>
              </div>
            );
          })()}

          <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 500 }}>
              {loading ? 'Cargando productos…' :
                filtered.length === products.length
                  ? `Todos los productos (${filtered.length})`
                  : `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`}
            </span>
            {(activeCategory !== 'Todos' || activeSubcategory !== 'Todos' || activeIndustry !== 'all' || activeBenefits.length > 0 || searchQuery) && (
              <button
                onClick={() => { setActiveCategory('Todos'); setActiveSubcategory('Todos'); setActiveIndustry('all'); setActiveBenefits([]); setSearchQuery(''); }}
                style={{ padding: '6px 14px', background: C.white, border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.textMuted, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                Limpiar filtros ✕
              </button>
            )}
          </div>

          {filtered.length > 0 ? (
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} onClick={setSelectedProduct} delay={Math.min(i * 0.05, 0.35)} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: C.white, borderRadius: 16, border: `1px solid ${C.borderLight}` }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Sin resultados para esos filtros</h3>
              <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>Probá con otra combinación o buscá por nombre.</p>
              <button
                onClick={() => { setActiveCategory('Todos'); setActiveIndustry('all'); setActiveBenefits([]); setSearchQuery(''); }}
                style={{ padding: '11px 24px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                Ver todos
              </button>
            </div>
          )}

          <FadeIn>
            <div style={{ marginTop: 40, background: C.white, border: `1px solid ${C.borderLight}`, borderRadius: 16, padding: '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accentPale, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 3 }}>Distribuidores oficiales de productos OKS</div>
                  <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 480 }}>Contamos con toda la línea OKS de lubricantes y productos especiales. Consultanos por disponibilidad y precios.</div>
                </div>
              </div>
              <a
                href="https://wa.me/5491162284649?text=Hola%2C%20quiero%20consultar%20por%20productos%20OKS"
                target="_blank" rel="noopener"
                style={{ padding: '11px 22px', background: '#25D366', color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                💬 Consultar por WhatsApp
              </a>
            </div>
          </FadeIn>

          <FadeIn>
            <div id="cotizar" style={{ marginTop: 24, background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, borderRadius: 20, padding: '48px 52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 36, color: C.white }}>
              <div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>¿No encontrás lo que buscás?</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85, margin: 0, maxWidth: 440 }}>Fabricamos productos a medida. Contanos qué problema querés resolver y nuestros ingenieros desarrollan la fórmula.</p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                <Link to="/#cotizar" style={{ padding: '14px 28px', background: C.white, color: C.accent, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Pedir Cotización →</Link>
                <a href="https://wa.me/5491162284649" target="_blank" rel="noopener" style={{ padding: '14px 28px', background: C.whatsapp, color: C.white, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>💬 WhatsApp</a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <a href="https://wa.me/5491162284649?text=Hola%2C%20quiero%20consultar%20por%20productos" target="_blank" rel="noopener"
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, width: 56, height: 56, borderRadius: 100, background: C.whatsapp, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(37,211,102,0.35)', textDecoration: 'none' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </>
  );
}
