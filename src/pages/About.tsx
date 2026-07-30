import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { setCartMode } from '../lib/cartMode';
import { SEO, SITE_URL } from '../components/SEO';

const C = {
  bg: '#f6f8fa',
  bgCard: '#FFFFFF',
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 24, height: 2, background: C.accent, borderRadius: 1 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
    </div>
  );
}

function Nav({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: scrolled ? `1px solid ${C.borderSubtle}` : '1px solid transparent', transition: 'all 0.3s ease', boxShadow: scrolled ? '0 1px 12px rgba(0,67,112,0.05)' : 'none' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: scrolled ? 60 : 72 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 48, width: 'auto' }} />
        </Link>
        <div className="desktop-nav-links" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <Link to="/catalogo" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Catálogo</Link>
          <Link to="/#soluciones" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Soluciones</Link>
          <span style={{ color: C.accent, fontSize: 14, fontWeight: 700 }}>Nosotros</span>
          <Link to="/#cotizar" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Contacto</Link>
          <Link to="/catalogo" onClick={() => setCartMode('pedido')} style={{ padding: '10px 22px', background: 'transparent', color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none', border: `1.5px solid ${C.border}` }}>Hacer mi pedido</Link>
          <Link to="/catalogo" onClick={() => setCartMode('cotizacion')} style={{ padding: '10px 24px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,103,172,0.2)' }}>Pedir Cotización</Link>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMenuOpen(o => !o)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'block', width: 24, height: 2, background: C.dark, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
          <span style={{ display: 'block', width: 24, height: 2, background: C.dark, borderRadius: 2, opacity: menuOpen ? 0 : 1 }} />
          <span style={{ display: 'block', width: 24, height: 2, background: C.dark, borderRadius: 2, transition: 'all 0.3s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
        </button>
      </div>
      {menuOpen && (
        <div style={{ background: C.white, borderTop: `1px solid ${C.borderSubtle}`, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link to="/catalogo" onClick={() => setMenuOpen(false)} style={{ color: C.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Catálogo</Link>
          <Link to="/#soluciones" onClick={() => setMenuOpen(false)} style={{ color: C.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Soluciones</Link>
          <Link to="/nosotros" onClick={() => setMenuOpen(false)} style={{ color: C.accent, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>Nosotros</Link>
          <Link to="/#cotizar" onClick={() => setMenuOpen(false)} style={{ color: C.text, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Contacto</Link>
          <Link to="/catalogo" onClick={() => { setCartMode('pedido'); setMenuOpen(false); }} style={{ padding: '12px 24px', border: `1.5px solid ${C.border}`, color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 8, background: 'transparent', textDecoration: 'none', textAlign: 'center' }}>Hacer mi pedido</Link>
          <Link to="/catalogo" onClick={() => { setCartMode('cotizacion'); setMenuOpen(false); }} style={{ padding: '12px 24px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none', textAlign: 'center' }}>Pedir Cotización</Link>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '70vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: C.white }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 70% 20%, ${C.accentMuted2} 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, ${C.accentMuted} 0%, transparent 50%)` }} />
      <div style={{ position: 'absolute', top: '15%', right: '8%', width: 400, height: 400, borderRadius: '50%', border: `1px solid ${C.border}`, opacity: 0.4 }} />
      <div style={{ position: 'absolute', top: '25%', right: '15%', width: 240, height: 240, borderRadius: '50%', border: `1px solid ${C.border}`, opacity: 0.3 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '160px 24px 80px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <FadeIn>
          <SectionLabel>Nosotros</SectionLabel>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 56, fontWeight: 800, lineHeight: 1.08, color: C.dark, margin: '12px 0 0', letterSpacing: '-0.03em', maxWidth: 900, marginInline: 'auto' }}>
            Más de 50 años en la industria.
            <br />
            <span style={{ color: C.accent }}>Pasión por la excelencia y la innovación.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p style={{ fontSize: 19, lineHeight: 1.7, color: C.textMuted, margin: '32px auto 0', maxWidth: 720 }}>
            Nos dedicamos a superar las expectativas con cada entrega. Se refleja en cada producto químico que fabricamos.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section style={{ background: C.bg, padding: '120px 24px' }}>
      <div className="grid-2" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        <FadeIn>
          <div>
            <SectionLabel>Quiénes somos</SectionLabel>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 40, fontWeight: 800, color: C.dark, letterSpacing: '-0.02em', margin: '0 0 24px', lineHeight: 1.15 }}>
              Brindamos la mejor calidad y servicio en todas nuestras entregas.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.textMuted, margin: '0 0 20px' }}>
              Nos enorgullecemos de nuestras <strong style={{ color: C.dark, fontWeight: 700 }}>fórmulas originales</strong>, diseñadas por ingenieros expertos y de nuestra capacidad para proporcionar soluciones efectivas y eficientes a nuestros clientes.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: C.textMuted, margin: 0 }}>
              Desde 1970 fabricamos productos químicos industriales en Liniers, CABA. Cada bidón que sale de nuestra planta lleva el sello de cinco décadas de desarrollo propio, ajustes finos y la convicción de que la fórmula correcta hace la diferencia entre limpiar bien y limpiar como corresponde.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, borderRadius: 24, padding: 56, color: C.white, position: 'relative', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,67,112,0.25)' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🏭</div>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 26, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.2 }}>
                Fabricantes argentinos desde 1970
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.9, margin: '0 0 28px' }}>
                Planta en Liniers, CABA. Producción propia con control de calidad lote a lote, logística directa y representantes comerciales en todo el país.
              </p>
              <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>📍 Casa central</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Ibarrola 7071, Liniers, CABA</div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function WhyLeaders() {
  const pillars = [
    {
      icon: '🧪',
      title: 'Productos elaborados por ingenieros expertos',
      desc: 'Cada producto de FEMAVI es el resultado de la pericia y dedicación de nuestros ingenieros. Utilizamos las mejores materias primas y procesos para garantizar resultados consistentes.',
    },
    {
      icon: '🤝',
      title: 'Representantes comerciales capacitados',
      desc: 'Nuestros representantes comerciales son el puente hacia soluciones a medida. Con una capacitación profunda en productos y aplicaciones, asesoran a cada cliente según su rubro.',
    },
    {
      icon: '⚙️',
      title: 'Servicio post-venta personalizado',
      desc: 'En FEMAVI el servicio no concluye con la venta. Ofrecemos un acompañamiento post-venta personalizado que garantiza el rendimiento del producto en tu operación.',
    },
  ];

  return (
    <section style={{ background: C.white, padding: '120px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <SectionLabel>Por qué somos líderes</SectionLabel>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 44, fontWeight: 800, color: C.dark, letterSpacing: '-0.03em', margin: '8px auto 12px', maxWidth: 720 }}>
              Nuestros productos y servicios están comprometidos con la
              <span style={{ color: C.accent }}> calidad e innovación.</span>
            </h2>
            <p style={{ fontSize: 17, color: C.textMuted, maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
              Tres pilares que sostienen nuestra propuesta de valor desde hace más de cinco décadas.
            </p>
          </div>
        </FadeIn>

        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {pillars.map((p, i) => (
            <FadeIn key={p.title} delay={i * 0.1}>
              <div style={{ padding: 40, background: C.white, borderRadius: 20, border: `1px solid ${C.borderSubtle}`, height: '100%', position: 'relative', transition: 'all 0.3s', boxShadow: '0 4px 16px rgba(0,67,112,0.04)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: C.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 24, border: `1px solid ${C.border}` }}>
                  {p.icon}
                </div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 700, color: C.dark, margin: '0 0 14px', lineHeight: 1.3 }}>{p.title}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textMuted, margin: 0 }}>{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { value: '+50', label: 'Años en la industria', sub: 'Desde 1970' },
    { value: '20.000+', label: 'Clientes activos', sub: 'En todo el país' },
    { value: '24', label: 'Provincias cubiertas', sub: 'Logística nacional' },
    { value: '100%', label: 'Garantía', sub: 'En todos nuestros productos' },
  ];

  return (
    <section style={{ background: `linear-gradient(135deg, ${C.darkDeep}, ${C.dark})`, padding: '100px 24px', color: C.white, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,128,212,0.08)' }} />
      <div style={{ position: 'absolute', bottom: -150, left: -150, width: 500, height: 500, borderRadius: '50%', background: 'rgba(0,103,172,0.06)' }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.accentLight, letterSpacing: '0.1em', textTransform: 'uppercase' }}>FEMAVI en números</span>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', margin: '12px 0 0', lineHeight: 1.2 }}>
              Cinco décadas, miles de operaciones.
            </h2>
          </div>
        </FadeIn>

        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.08}>
              <div style={{ padding: 32, background: 'rgba(255,255,255,0.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 48, fontWeight: 800, color: C.accentLight, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{s.sub}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section style={{ background: C.bg, padding: '100px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ background: C.white, borderRadius: 24, padding: 56, textAlign: 'center', border: `1px solid ${C.borderSubtle}`, boxShadow: '0 16px 48px rgba(0,67,112,0.06)' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>📞</div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 36, fontWeight: 800, color: C.dark, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              Sumate a las miles de empresas que ya confían en FEMAVI
            </h2>
            <p style={{ fontSize: 17, color: C.textMuted, margin: '0 0 32px', lineHeight: 1.6 }}>
              Pedí tu cotización sin compromiso. Te respondemos en menos de 24 horas hábiles con una propuesta adaptada a tu volumen.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/catalogo" onClick={() => setCartMode('cotizacion')} style={{ padding: '16px 32px', background: C.accent, color: C.white, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', boxShadow: '0 8px 24px rgba(0,103,172,0.25)' }}>
                Pedir Cotización →
              </Link>
              <Link to="/catalogo" style={{ padding: '16px 32px', border: `1.5px solid ${C.border}`, color: C.accent, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', background: C.white }}>
                Ver Catálogo
              </Link>
              <a href="https://wa.me/5491162284649" target="_blank" rel="noopener" style={{ padding: '16px 32px', background: C.whatsapp, color: C.white, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                💬 WhatsApp
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: C.darkDeep, padding: '64px 24px 32px', color: C.white }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 32, width: 'auto', borderRadius: 6 }} />
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', maxWidth: 300 }}>Fabricantes de productos químicos industriales desde 1970. Fórmulas de desarrollo propio con entrega en todo el país.</p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accentLight, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sitio</div>
            <Link to="/" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 10 }}>Inicio</Link>
            <Link to="/catalogo" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 10 }}>Catálogo</Link>
            <Link to="/nosotros" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 10 }}>Nosotros</Link>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accentLight, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Industrias</div>
            {[
              { label: 'Transporte', ind: 'Transporte' },
              { label: 'Gastronomía', ind: 'Gastronomía' },
              { label: 'Edificios', ind: 'Edificios' },
              { label: 'Industria', ind: 'Industria' },
              { label: 'Empresas de limpieza', ind: 'Empresas de limpieza' },
              { label: 'Automotor', ind: 'Automotor' },
            ].map(({ label, ind }) => (
              <Link key={label} to={`/catalogo?industria=${encodeURIComponent(ind)}`} style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 10 }}>{label}</Link>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accentLight, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contacto</div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, margin: 0 }}>
              Ibarrola 7071<br />Liniers, CABA<br />
              <a href="tel:+5491162284649" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>+54 9 116228-4649</a><br />
              <a href="mailto:ventas@femavi.com.ar" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>ventas@femavi.com.ar</a>
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
  return (
    <a
      href="https://wa.me/5491162284649?text=Hola%2C%20quiero%20consultar%20por%20productos"
      target="_blank"
      rel="noopener"
      style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, width: 56, height: 56, borderRadius: 100, background: C.whatsapp, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 8px 28px rgba(37,211,102,0.45)' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}

export default function About() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.background = C.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  const aboutJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/nosotros#webpage`,
    url: `${SITE_URL}/nosotros`,
    name: 'Sobre FEMAVI — Fabricantes argentinos de productos químicos industriales',
    description:
      'Más de 50 años fabricando productos químicos industriales en Argentina. Fórmulas de desarrollo propio diseñadas por ingenieros, representantes capacitados y servicio post-venta personalizado.',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Nosotros', item: `${SITE_URL}/nosotros` },
      ],
    },
  };

  return (
    <>
      <SEO
        title="Nosotros — FEMAVI fabricantes argentinos desde 1970"
        description="Más de 50 años fabricando productos químicos industriales en Argentina. Fórmulas de desarrollo propio diseñadas por ingenieros, representantes comerciales capacitados y servicio post-venta personalizado. +20.000 clientes en 24 provincias."
        canonical={SITE_URL + '/nosotros'}
        jsonLd={aboutJsonLd}
      />
      <Nav scrolled={scrolled} />
      <Hero />
      <Story />
      <WhyLeaders />
      <StatsSection />
      <CTA />
      <Footer />
      <WhatsAppButton />
    </>
  );
}
