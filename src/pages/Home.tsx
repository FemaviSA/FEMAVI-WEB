import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { useQuoteCart } from '../hooks/useQuoteCart';
import { createQuote } from '../lib/quotes';
import { SEO, SITE_URL } from '../components/SEO';
import type { Product } from '../types/product';

const COLORS = {
  bg: '#f6f8fa',
  bgCard: '#FFFFFF',
  bgAlt: '#FFFFFF',
  accent: '#0067ac',
  accentLight: '#0080d4',
  accentDark: '#004370',
  accentMuted: 'rgba(0,103,172,0.07)',
  accentMuted2: 'rgba(0,103,172,0.13)',
  dark: '#003058',
  darkDeep: '#001c33',
  text: '#1a2b3c',
  textMuted: '#5a6f80',
  textDark: '#8899a8',
  border: 'rgba(0,103,172,0.15)',
  borderSubtle: '#e2e8ee',
  white: '#FFFFFF',
  whatsapp: '#25D366',
};

const verticals = [
  { id: 'transporte', icon: '🚌', title: 'Transporte y Flotas', desc: 'Limpieza y mantenimiento para líneas de colectivo, trenes, flotas de camiones y vehículos de carga. Desengrasantes de alta potencia, limpiadores de tapizados, sanitizantes y productos para tren delantero.', products: 'Desengrasantes, Sanitizantes, Limpiadores multiuso, Ceras' },
  { id: 'talleres', icon: '🔧', title: 'Talleres Mecánicos', desc: 'Todo lo que un taller necesita: desengrasantes para motores, limpiadores de frenos, lubricantes, aceites de corte y productos para lavado de piezas. Rendimiento industrial a precio accesible.', products: 'Desengrasantes, Lubricantes, Aceites de corte, Anticorrosivos' },
  { id: 'rectificadoras', icon: '⚙️', title: 'Rectificadoras y Mecanizados', desc: 'Fluidos de corte, aceites solubles, desengrasantes para metales y anticorrosivos para la industria de rectificado y mecanizado de precisión. Compatibles con todos los metales.', products: 'Aceites de corte, Fluidos solubles, Anticorrosivos, Desengrasantes' },
  { id: 'mineria', icon: '⛏️', title: 'Minería e Industria Pesada', desc: 'Lubricantes de alto rendimiento, grasas para maquinaria pesada, anticorrosivos y productos de limpieza para entornos exigentes. Formulados para resistir condiciones extremas.', products: 'Grasas industriales, Lubricantes, Anticorrosivos, Desengrasantes' },
  { id: 'alimenticia', icon: '🍽️', title: 'Industria Alimenticia', desc: 'Bactericidas, desengrasantes y lubricantes aptos para superficies en contacto con alimentos. Cumplimos con los requerimientos SENASA para plantas procesadoras y frigoríficos.', products: 'Bactericidas, Aceites alimenticios, Sanitizantes, Desengrasantes' },
  { id: 'gastronomia', icon: '🍳', title: 'Gastronomía y Hotelería', desc: 'Desengrasantes de cocina industrial, detergentes de alta dilución, bactericidas y limpiadores multiuso para restaurantes, hoteles y comedores industriales.', products: 'Desengrasantes, Bactericidas, Detergentes, Sanitizantes' },
  { id: 'edificios', icon: '🏢', title: 'Edificios y Consorcios', desc: 'Ceras acrílicas, limpiadores de pisos, detergentes, aromatizantes y productos de higiene para espacios corporativos, consorcios y centros comerciales.', products: 'Ceras, Detergentes, Limpiadores, Aromatizantes' },
  { id: 'salud', icon: '🏥', title: 'Salud y Sanidad', desc: 'Desinfectantes de superficies, bactericidas, sanitizantes y productos de higiene personal para clínicas, hospitales, geriátricos y laboratorios.', products: 'Desinfectantes, Bactericidas, Sanitizantes, Jabones' },
  { id: 'manufactura', icon: '🏭', title: 'Manufactura e Industria en General', desc: 'Lubricantes, desmoldantes, solventes dieléctricos, anticorrosivos y desengrasantes para cualquier línea de producción. Si tu planta necesita limpiar o mantener, tenemos la fórmula.', products: 'Lubricantes, Desmoldantes, Anticorrosivos, Desengrasantes' },
  { id: 'limpieza', icon: '🧹', title: 'Empresas de Limpieza', desc: 'Línea completa de productos de alto rendimiento y gran dilución para empresas de limpieza profesional. Comprá al por mayor y maximizá tu margen con fórmulas que rinden más.', products: 'Detergentes, Ceras, Desengrasantes, Desinfectantes' },
];

const testimonials = [
  { name: 'Carlos M.', role: 'Gerente de Mantenimiento', company: 'Línea de colectivos — AMBA', text: 'Hace 8 años que usamos Femavi para toda la flota. Probamos otros proveedores y siempre volvimos. El rendimiento no se compara y la entrega nunca falla.' },
  { name: 'Patricia L.', role: 'Facility Manager', company: 'Edificio corporativo — Microcentro', text: 'La cera acrílica rinde el doble que lo que usábamos antes. Pero lo que más valoro es el seguimiento postventa, siempre están encima.' },
  { name: 'Roberto D.', role: 'Dueño', company: 'Empresa de limpieza — Zona Sur', text: 'Arrancamos con un par de productos y hoy les compramos toda la línea. Los precios son justos y la calidad es consistente lote a lote.' },
];

const categories = [
  'Aceites y Aditivos', 'Aerosoles', 'Anticorrosivos', 'Ceras', 'Desengrasantes',
  'Desinfectantes', 'Desmoldantes', 'Detergentes', 'Grasas', 'Higiene Industrial',
  'Insecticida', 'Lavamanos', 'Limpiadores', 'Línea Automotor', 'Lubricantes',
  'Tratamiento para Aguas',
];

function useInView(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)', transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s` }}>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'inline-block', padding: '5px 14px', background: COLORS.accentMuted, color: COLORS.accent, fontSize: 12, fontWeight: 700, borderRadius: 100, letterSpacing: '0.05em', textTransform: 'uppercase', border: `1px solid ${COLORS.border}` }}>{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 24, height: 2, background: COLORS.accent, borderRadius: 1 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
    </div>
  );
}

function Nav({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: scrolled ? `1px solid ${COLORS.borderSubtle}` : '1px solid transparent', transition: 'all 0.3s ease', boxShadow: scrolled ? '0 1px 12px rgba(0,67,112,0.05)' : 'none' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: scrolled ? 60 : 72 }}>
        <Link to="/" onClick={() => window.scrollTo(0, 0)} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 48, width: 'auto' }} />
        </Link>
        <div className="desktop-nav-links" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <Link to="/catalogo" style={{ color: COLORS.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Catálogo</Link>
          <a href="#soluciones" style={{ color: COLORS.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Soluciones</a>
          <Link to="/nosotros" style={{ color: COLORS.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Nosotros</Link>
          <a href="#contacto" style={{ color: COLORS.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Contacto</a>
          <Link to="/cotizar" style={{ padding: '10px 24px', background: COLORS.accent, color: COLORS.white, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,103,172,0.2)' }}>Pedir Cotización</Link>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMenuOpen(o => !o)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'block', width: 24, height: 2, background: COLORS.dark, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
          <span style={{ display: 'block', width: 24, height: 2, background: COLORS.dark, borderRadius: 2, opacity: menuOpen ? 0 : 1 }} />
          <span style={{ display: 'block', width: 24, height: 2, background: COLORS.dark, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
        </button>
      </div>
      {menuOpen && (
        <div style={{ background: COLORS.white, borderTop: `1px solid ${COLORS.borderSubtle}`, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link to="/catalogo" onClick={() => setMenuOpen(false)} style={{ color: COLORS.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Catálogo</Link>
          <a href="#soluciones" onClick={() => setMenuOpen(false)} style={{ color: COLORS.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Soluciones</a>
          <Link to="/nosotros" onClick={() => setMenuOpen(false)} style={{ color: COLORS.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Nosotros</Link>
          <a href="#contacto" onClick={() => setMenuOpen(false)} style={{ color: COLORS.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Contacto</a>
          <Link to="/cotizar" onClick={() => setMenuOpen(false)} style={{ padding: '12px 24px', background: COLORS.accent, color: COLORS.white, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none', textAlign: 'center' }}>Pedir Cotización</Link>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: COLORS.white }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 70% 20%, ${COLORS.accentMuted2} 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, ${COLORS.accentMuted} 0%, transparent 50%)` }} />
      <div style={{ position: 'absolute', top: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%', border: `1px solid ${COLORS.border}`, opacity: 0.4 }} />
      <div style={{ position: 'absolute', top: '20%', right: '10%', width: 300, height: 300, borderRadius: '50%', border: `1px solid ${COLORS.border}`, opacity: 0.3 }} />
      <div className="hero-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '140px 24px 80px', position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        <div>
          <FadeIn><Badge>+50 años en la industria</Badge></FadeIn>
          <FadeIn delay={0.1}>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 56, fontWeight: 800, lineHeight: 1.08, color: COLORS.dark, margin: '24px 0 0', letterSpacing: '-0.03em' }}>
              Productos químicos industriales de
              <span style={{ color: COLORS.accent }}> desarrollo propio</span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: COLORS.textMuted, margin: '24px 0 0', maxWidth: 480 }}>
              Fabricamos y entregamos en 48 horas. Más de 20.000 clientes en todo el país confían en la calidad de nuestras fórmulas para transporte, gastronomía, edificios e industria.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
              <Link to="/catalogo" style={{ padding: '16px 36px', background: COLORS.accent, color: COLORS.white, fontSize: 16, fontWeight: 700, borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,103,172,0.25)' }}>
                Solicitar Cotización <span style={{ fontSize: 20 }}>→</span>
              </Link>
              <Link to="/catalogo" style={{ padding: '16px 36px', border: `1.5px solid ${COLORS.border}`, color: COLORS.accent, fontSize: 16, fontWeight: 700, borderRadius: 10, textDecoration: 'none', cursor: 'pointer', background: COLORS.white }}>
                Ver Catálogo
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div style={{ display: 'flex', gap: 48, marginTop: 56, paddingTop: 32, borderTop: `1px solid ${COLORS.borderSubtle}` }}>
              {[['20.000+', 'Clientes activos'], ['48hs', 'Entrega garantizada'], ['100%', 'Desarrollo propio']].map(([num, label]) => (
                <div key={num}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 800, color: COLORS.accent }}>{num}</div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
        <FadeIn delay={0.2}>
          <div style={{ background: COLORS.white, borderRadius: 24, border: `1px solid ${COLORS.borderSubtle}`, padding: 48, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '0 24px 60px rgba(0,67,112,0.08)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Categorías principales</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map(c => (
                <span key={c} style={{ padding: '7px 14px', background: COLORS.accentMuted, borderRadius: 100, fontSize: 13, color: COLORS.accent, fontWeight: 600, border: `1px solid ${COLORS.border}` }}>{c}</span>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: 20, background: COLORS.accentMuted, borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, color: COLORS.textMuted }}>¿No encontrás lo que buscás?</div>
              <div style={{ fontSize: 15, color: COLORS.dark, fontWeight: 700, marginTop: 4 }}>Fabricamos productos a medida para tu industria</div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function Verticals() {
  const [active, setActive] = useState(0);
  return (
    <section id="soluciones" style={{ background: COLORS.bg, padding: '120px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <FadeIn>
          <SectionLabel>Soluciones por industria</SectionLabel>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 44, fontWeight: 800, color: COLORS.dark, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
            Cada industria tiene sus necesidades.
            <span style={{ color: COLORS.textMuted }}> Nosotros tenemos las fórmulas.</span>
          </h2>
        </FadeIn>
        <div className="vertical-grid" style={{ marginTop: 64, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {verticals.map((v, i) => (
              <button key={v.id} onClick={() => setActive(i)} style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 10, background: active === i ? COLORS.white : 'transparent', border: active === i ? `1px solid ${COLORS.border}` : '1px solid transparent', cursor: 'pointer', transition: 'all 0.3s', boxShadow: active === i ? '0 8px 24px rgba(0,67,112,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{v.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: active === i ? COLORS.accent : COLORS.textMuted, transition: 'color 0.3s', lineHeight: 1.3 }}>{v.title}</span>
              </button>
            ))}
          </div>
          <FadeIn key={active}>
            <div style={{ background: COLORS.white, borderRadius: 24, border: `1px solid ${COLORS.borderSubtle}`, padding: 56, boxShadow: '0 16px 48px rgba(0,67,112,0.06)' }}>
              <div style={{ fontSize: 48, marginBottom: 24 }}>{verticals[active].icon}</div>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 32, fontWeight: 800, color: COLORS.dark, margin: '0 0 16px' }}>{verticals[active].title}</h3>
              <p style={{ fontSize: 17, lineHeight: 1.8, color: COLORS.textMuted, margin: '0 0 32px', maxWidth: 520 }}>{verticals[active].desc}</p>
              <div style={{ padding: 20, background: COLORS.accentMuted, borderRadius: 12, marginBottom: 32, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Productos recomendados</div>
                <div style={{ fontSize: 15, color: COLORS.dark, fontWeight: 600 }}>{verticals[active].products}</div>
              </div>
              <Link to="/catalogo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: COLORS.accent, color: COLORS.white, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,103,172,0.2)' }}>
                Cotizar para {verticals[active].title.split(' ')[0]} →
              </Link>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function ProductsSection({ products, loading }: { products: Product[]; loading: boolean }) {
  const featured = products.filter(p => p.featured).slice(0, 6);
  return (
    <section id="productos" style={{ background: COLORS.white, padding: '120px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <FadeIn>
          <SectionLabel>Catálogo</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56 }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 44, fontWeight: 800, color: COLORS.dark, letterSpacing: '-0.03em', margin: 0 }}>
              Productos destacados
            </h2>
            <Link to="/catalogo" style={{ color: COLORS.accent, fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              Ver catálogo completo →
            </Link>
          </div>
        </FadeIn>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: COLORS.textMuted }}>Cargando productos…</div>
        ) : (
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {featured.map((p, i) => (
              <FadeIn key={p.id} delay={i * 0.08}>
                <Link to={`/catalogo/${p.slug}`} style={{ textDecoration: 'none', display: 'block', background: COLORS.white, borderRadius: 16, border: `1px solid ${COLORS.borderSubtle}`, overflow: 'hidden', transition: 'all 0.3s', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 48px rgba(0,103,172,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.borderSubtle; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ padding: 32, display: 'flex', justifyContent: 'center', background: COLORS.bg }}>
                    {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: 140, height: 140, objectFit: 'contain' }} />}
                  </div>
                  <div style={{ padding: '24px 28px 28px' }}>
                    <Badge>{p.category}</Badge>
                    <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: COLORS.dark, margin: '12px 0 8px' }}>{p.name}</h3>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.textMuted, margin: '0 0 16px' }}>{p.description}</p>
                    <div style={{ fontSize: 12, color: COLORS.textDark }}>
                      <span style={{ color: COLORS.accent, fontWeight: 700 }}>Uso:</span> {p.industries.join(', ')}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                      <span style={{ flex: 1, padding: '12px 0', background: COLORS.accent, color: COLORS.white, fontSize: 13, fontWeight: 700, borderRadius: 8, textAlign: 'center' }}>Cotizar</span>
                      <span style={{ flex: 1, padding: '12px 0', border: `1px solid ${COLORS.border}`, color: COLORS.accent, fontSize: 13, fontWeight: 600, borderRadius: 8, textAlign: 'center', background: 'transparent' }}>Ficha técnica</span>
                    </div>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    { num: '01', title: 'Cotización a medida', desc: 'Contanos qué necesitás. En menos de 24 horas te enviamos una cotización adaptada a tu volumen y frecuencia de compra.', icon: '📋' },
    { num: '02', title: 'Entrega en 48 horas', desc: 'Producimos y despachamos. Entrega directa en AMBA y envíos a todo el país con logística propia.', icon: '🚛' },
    { num: '03', title: 'Seguimiento postventa', desc: 'No desaparecemos después de la venta. Te acompañamos para asegurar que el producto rinda al máximo en tu operación.', icon: '🤝' },
  ];
  return (
    <section style={{ background: COLORS.bg, padding: '120px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <FadeIn>
          <SectionLabel>Cómo trabajamos</SectionLabel>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 44, fontWeight: 800, color: COLORS.dark, letterSpacing: '-0.03em', margin: '0 0 64px' }}>
            De tu consulta a tu depósito
            <span style={{ color: COLORS.textMuted }}> en 3 pasos.</span>
          </h2>
        </FadeIn>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.12}>
              <div style={{ padding: 40, background: COLORS.white, borderRadius: 20, border: `1px solid ${COLORS.borderSubtle}`, height: '100%', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,67,112,0.04)' }}>
                <div style={{ position: 'absolute', top: -20, right: -10, fontSize: 120, fontWeight: 900, color: COLORS.accentMuted, fontFamily: "'DM Sans', sans-serif" }}>{s.num}</div>
                <div style={{ fontSize: 40, marginBottom: 24, position: 'relative' }}>{s.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, marginBottom: 12, letterSpacing: '0.05em', position: 'relative' }}>PASO {s.num}</div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: COLORS.dark, margin: '0 0 12px', position: 'relative' }}>{s.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: COLORS.textMuted, margin: 0, position: 'relative' }}>{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section style={{ background: COLORS.white, padding: '120px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <FadeIn>
          <SectionLabel>Testimonios</SectionLabel>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 44, fontWeight: 800, color: COLORS.dark, letterSpacing: '-0.03em', margin: '0 0 64px' }}>
            Quien prueba, se queda.
          </h2>
        </FadeIn>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {testimonials.map((t, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div style={{ padding: 36, background: COLORS.bg, borderRadius: 20, border: `1px solid ${COLORS.borderSubtle}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                  {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ color: COLORS.accent, fontSize: 18 }}>★</span>)}
                </div>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: COLORS.text, margin: '0 0 28px', flex: 1, fontStyle: 'italic' }}>"{t.text}"</p>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted }}>{t.role}</div>
                  <div style={{ fontSize: 13, color: COLORS.accent, marginTop: 2, fontWeight: 600 }}>{t.company}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteForm() {
  const { slugs, clear } = useQuoteCart();
  const [formData, setFormData] = useState({ nombre: '', email: '', telefono: '', empresa: '', rubro: '', mensaje: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData(p => ({ ...p, [field]: e.target.value }));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 18px', background: COLORS.white, border: `1px solid ${COLORS.borderSubtle}`,
    borderRadius: 10, color: COLORS.text, fontSize: 15, fontFamily: "'DM Sans', sans-serif",
    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  };

  const rubros = ['Transporte', 'Gastronomía', 'Edificios / Consorcios', 'Industria / Manufactura', 'Empresa de Limpieza', 'Salud', 'Educación', 'Otro'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createQuote({
        name: formData.nombre,
        email: formData.email,
        phone: formData.telefono || null,
        company: formData.empresa || null,
        industry: formData.rubro || null,
        message: formData.mensaje || null,
        product_slugs: slugs,
      });
      setSubmitted(true);
      if (slugs.length > 0) clear();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos enviar la consulta. Probá por WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="contacto" style={{ background: COLORS.bg, padding: '120px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>✅</div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 36, fontWeight: 800, color: COLORS.dark }}>¡Recibimos tu consulta!</h2>
          <p style={{ fontSize: 17, color: COLORS.textMuted, marginTop: 16 }}>Un representante comercial se va a comunicar con vos en las próximas 24 horas hábiles.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="cotizar" style={{ background: COLORS.bg, padding: '120px 24px' }}>
      <form onSubmit={handleSubmit} className="grid-2" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
        <FadeIn>
          <div>
            <SectionLabel>Contacto</SectionLabel>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 44, fontWeight: 800, color: COLORS.dark, letterSpacing: '-0.03em', margin: '0 0 20px' }}>
              Realizá tu consulta
              <span style={{ color: COLORS.textMuted }}> sin compromiso</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: COLORS.textMuted, margin: '0 0 48px' }}>
              Contanos qué productos necesitás y para qué rubro. Te respondemos en menos de 24 horas con una cotización adaptada a tu volumen.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[['📍', 'Ibarrola 7071, Liniers, CABA'], ['📞', '+54 9 116228-4649'], ['✉️', 'ventas@femavi.com.ar'], ['🕐', 'Lunes a Viernes 8:00 a 17:00']].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 15, color: COLORS.text, fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div style={{ background: COLORS.white, borderRadius: 24, border: `1px solid ${COLORS.borderSubtle}`, padding: 40, boxShadow: '0 16px 48px rgba(0,67,112,0.06)' }}>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre *</label>
                <input required style={inputStyle} value={formData.nombre} onChange={handleChange('nombre')} placeholder="Tu nombre" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email *</label>
                <input required style={inputStyle} type="email" value={formData.email} onChange={handleChange('email')} placeholder="tu@empresa.com" />
              </div>
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teléfono</label>
                <input style={inputStyle} value={formData.telefono} onChange={handleChange('telefono')} placeholder="+54 11 ..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razón social *</label>
                <input required style={inputStyle} value={formData.empresa} onChange={handleChange('empresa')} placeholder="Nombre de tu empresa" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rubro</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={formData.rubro} onChange={handleChange('rubro')}>
                <option value="">Seleccioná tu rubro</option>
                {rubros.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>¿Qué productos o servicios necesitás?</label>
              <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={formData.mensaje} onChange={handleChange('mensaje')} placeholder="Ej: Necesito desengrasante industrial para flota de 30 colectivos, entrega mensual..." />
            </div>
            {slugs.length > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: COLORS.accentMuted, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, color: COLORS.dark }}>
                ✓ Tu consulta incluye <strong>{slugs.length} producto{slugs.length !== 1 ? 's' : ''}</strong> seleccionado{slugs.length !== 1 ? 's' : ''} del catálogo.
              </div>
            )}
            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, fontSize: 14 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={submitting} style={{ width: '100%', padding: '16px', background: submitting ? COLORS.textDark : COLORS.accent, color: COLORS.white, fontSize: 16, fontWeight: 700, borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: submitting ? 'none' : '0 8px 20px rgba(0,103,172,0.25)' }}>
              {submitting ? 'Enviando…' : 'Enviar Consulta →'}
            </button>
            <p style={{ fontSize: 12, color: COLORS.textDark, textAlign: 'center', marginTop: 16 }}>Te respondemos en menos de 24 horas hábiles. Sin compromiso.</p>
          </div>
        </FadeIn>
      </form>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: COLORS.darkDeep, padding: '64px 24px 32px', color: COLORS.white }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${COLORS.accentLight}, ${COLORS.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: COLORS.white }}>F</div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.white }}>FEMAVI</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', maxWidth: 300 }}>Fabricantes de productos químicos industriales desde 1970. Fórmulas de desarrollo propio con entrega en todo el país.</p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accentLight, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Productos</div>
            {['Desengrasantes', 'Lubricantes', 'Desinfectantes', 'Ceras', 'Aerosoles', 'Aceites'].map(l => (
              <Link key={l} to="/catalogo" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 10, cursor: 'pointer' }}>{l}</Link>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accentLight, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Industrias</div>
            {['Transporte', 'Gastronomía', 'Edificios', 'Manufactura', 'Empresas de limpieza', 'Automotor'].map(l => (
              <Link key={l} to="/catalogo" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 10, cursor: 'pointer' }}>{l}</Link>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accentLight, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contacto</div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, margin: 0 }}>
              Ibarrola 7071<br />Liniers, CABA<br />+54 9 116228-4649<br />ventas@femavi.com.ar
            </p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>© 2026 Femavi S.A. Todos los derechos reservados.</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Ibarrola 7071, Liniers, CABA, Argentina</span>
        </div>
      </div>
    </footer>
  );
}

function WhatsAppButton() {
  const [hover, setHover] = useState(false);
  return (
    <a href="https://wa.me/5491162284649?text=Hola%2C%20quiero%20consultar%20por%20productos" target="_blank" rel="noopener" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, display: 'flex', alignItems: 'center', gap: 12, padding: hover ? '16px 24px 16px 20px' : '16px', background: COLORS.whatsapp, borderRadius: 100, textDecoration: 'none', boxShadow: '0 8px 28px rgba(37,211,102,0.45)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      {hover && <span style={{ color: 'white', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>Chateá con Ventas</span>}
    </a>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const { products, loading } = useProducts();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.background = COLORS.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/#webpage`,
    url: SITE_URL,
    name: 'FEMAVI — Productos Químicos Industriales en Argentina',
    description:
      'Fabricantes argentinos de productos químicos industriales con más de 50 años. Desengrasantes, bactericidas, ceras, lubricantes. Entrega en 48 hs.',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL }],
    },
  };

  return (
    <>
      <SEO
        title="Productos Químicos Industriales en Argentina — FEMAVI"
        description="Fabricantes argentinos de productos químicos industriales con +50 años: desengrasantes, bactericidas, ceras acrílicas, lubricantes y aerosoles. Fórmulas de desarrollo propio, entrega en 48 hs en todo el país. +20.000 clientes."
        canonical={SITE_URL + '/'}
        jsonLd={homeJsonLd}
      />
      <Nav scrolled={scrolled} />
      <Hero />
      <Verticals />
      <ProductsSection products={products} loading={loading} />
      <Process />
      <Testimonials />
      <QuoteForm />
      <Footer />
      <WhatsAppButton />
    </>
  );
}
