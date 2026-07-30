import { Link } from 'react-router-dom';
import { SEO, SITE_URL } from '../components/SEO';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', borderLight: '#e2e8ee',
  green: '#16a34a',
};

export type VerticalConfig = {
  slug: string;
  icon: string;
  name: string;
  heroTitle: string;
  heroDesc: string;
  seoTitle: string;
  seoDesc: string;
  keywords: string;
  color: string;
  products: { name: string; desc: string; slug?: string }[];
  benefits: { icon: string; title: string; desc: string }[];
  faq: { q: string; a: string }[];
  blogSlugs: { slug: string; title: string }[];
  cta: string;
};

function Nav() {
  return (
    <header style={{ background: C.white, borderBottom: `1px solid ${C.borderLight}`, position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/"><img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 36 }} /></Link>
        <nav style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link to="/catalogo" style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textDecoration: 'none' }}>Catálogo</Link>
          <Link to="/nosotros" style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textDecoration: 'none' }}>Nosotros</Link>
          <Link to="/cotizar" style={{ fontSize: 14, fontWeight: 700, color: C.white, background: C.accent, padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>
            Cotizar ahora
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function VerticalPage({ v }: { v: VerticalConfig }) {
  return (
    <>
      <SEO
        title={v.seoTitle}
        description={v.seoDesc}
        canonical={`${SITE_URL}/industrias/${v.slug}`}
        type="website"
      />
      <Nav />

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.accent} 100%)`, padding: '72px 24px 64px', color: C.white }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{v.icon}</div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
            Soluciones para {v.name}
          </span>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '14px 0 20px', lineHeight: 1.15 }}>
            {v.heroTitle}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.7, opacity: 0.88, maxWidth: 680, margin: '0 auto 36px' }}>
            {v.heroDesc}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/cotizar" style={{ padding: '14px 32px', background: C.white, color: C.accent, fontWeight: 800, fontSize: 15, borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              Solicitar cotización →
            </Link>
            <a href={`https://wa.me/5491162284649?text=${encodeURIComponent(`Hola FEMAVI, necesito productos para ${v.name}.`)}`} target="_blank" rel="noopener noreferrer"
              style={{ padding: '14px 28px', background: '#25D366', color: C.white, fontWeight: 700, fontSize: 15, borderRadius: 10, textDecoration: 'none' }}>
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Prueba social */}
      <section style={{ background: C.white, borderBottom: `1px solid ${C.borderLight}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', display: 'flex', gap: 48, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          {[['50+', 'años en la industria'], ['20.000+', 'clientes activos'], ['48 hs', 'entrega en AMBA'], ['Fórmula', 'de desarrollo propio']].map(([val, lab]) => (
            <div key={lab} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, fontFamily: "'DM Sans', sans-serif" }}>{val}</div>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, marginTop: 2 }}>{lab}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Productos */}
      <section style={{ background: C.bg, padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.accent }}>Catálogo</span>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: C.dark, margin: '10px 0 12px' }}>
              Productos recomendados para {v.name}
            </h2>
            <p style={{ color: C.textMuted, fontSize: 15, maxWidth: 560, margin: '0 auto' }}>
              Selección de nuestro catálogo específica para las necesidades de tu rubro.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {v.products.map(p => (
              <div key={p.name} style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.borderLight}`, padding: '28px 24px' }}>
                <div style={{ width: 40, height: 40, background: C.accentPale, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ width: 16, height: 16, background: C.accent, borderRadius: 3 }} />
                </div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 700, color: C.dark, margin: '0 0 8px' }}>{p.name}</h3>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, margin: '0 0 16px' }}>{p.desc}</p>
                <Link to={p.slug ? `/catalogo/${p.slug}` : '/catalogo'} style={{ fontSize: 13, fontWeight: 700, color: C.accent, textDecoration: 'none' }}>
                  Ver en catálogo →
                </Link>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <Link to="/catalogo" style={{ display: 'inline-block', padding: '12px 28px', border: `2px solid ${C.accent}`, color: C.accent, fontWeight: 700, borderRadius: 10, textDecoration: 'none', fontSize: 14 }}>
              Ver catálogo completo
            </Link>
          </div>
        </div>
      </section>

      {/* Por qué FEMAVI */}
      <section style={{ background: C.white, padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: C.dark, margin: '0 0 12px' }}>
              {v.cta}
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
            {v.benefits.map(b => (
              <div key={b.title} style={{ padding: '28px 24px', border: `1px solid ${C.borderLight}`, borderRadius: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{b.icon}</div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: C.dark, margin: '0 0 8px' }}>{b.title}</h3>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: 0 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA intermedio */}
      <section style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, padding: '56px 24px', textAlign: 'center', color: C.white }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, margin: '0 0 14px' }}>
            ¿Querés ver precios o hacer un pedido de muestra?
          </h2>
          <p style={{ fontSize: 16, opacity: 0.85, margin: '0 0 28px' }}>
            Completá el formulario y un asesor te responde en menos de 24 horas hábiles.
          </p>
          <Link to="/cotizar" style={{ display: 'inline-block', padding: '14px 36px', background: C.white, color: C.accent, fontWeight: 800, fontSize: 15, borderRadius: 10, textDecoration: 'none' }}>
            Solicitar cotización sin compromiso
          </Link>
        </div>
      </section>

      {/* FAQ */}
      {v.faq.length > 0 && (
        <section style={{ background: C.bg, padding: '64px 24px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 800, color: C.dark, margin: '0 0 36px', textAlign: 'center' }}>
              Preguntas frecuentes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {v.faq.map(f => (
                <details key={f.q} style={{ background: C.white, border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: '20px 24px' }}>
                  <summary style={{ fontWeight: 700, fontSize: 15, color: C.dark, cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {f.q}
                    <span style={{ color: C.accent, fontSize: 20, fontWeight: 400, marginLeft: 12, flexShrink: 0 }}>+</span>
                  </summary>
                  <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7, margin: '14px 0 0' }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Blog links */}
      {v.blogSlugs.length > 0 && (
        <section style={{ background: C.white, padding: '48px 24px', borderTop: `1px solid ${C.borderLight}` }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: '0 0 24px', textAlign: 'center' }}>
              Guías técnicas relacionadas
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {v.blogSlugs.map(b => (
                <Link key={b.slug} to={`/blog/${b.slug}`} style={{ padding: '16px 20px', border: `1px solid ${C.borderLight}`, borderRadius: 10, textDecoration: 'none', color: C.dark, fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg }}>
                  {b.title}
                  <span style={{ color: C.accent }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer style={{ background: C.dark, color: 'rgba(255,255,255,0.6)', padding: '32px 24px', textAlign: 'center', fontSize: 13 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          © {new Date().getFullYear()} FEMAVI S.A. — Ibarrola 7071, Liniers, CABA — <Link to="/" style={{ color: C.accent, textDecoration: 'none' }}>Inicio</Link>
          {' · '}
          <Link to="/catalogo" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Catálogo</Link>
          {' · '}
          <Link to="/cotizar" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Cotizar</Link>
        </div>
      </footer>
    </>
  );
}
