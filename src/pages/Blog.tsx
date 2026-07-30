import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { listArticles } from '../lib/articles';
import { SEO, SITE_URL } from '../components/SEO';
import type { Article } from '../types/article';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', borderLight: '#e2e8ee',
};

export default function Blog() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.style.background = C.bg;
    listArticles().then(setArticles).finally(() => setLoading(false));
    return () => { document.body.style.background = ''; };
  }, []);

  return (
    <>
      <SEO
        title="Blog FEMAVI — Guías y recursos sobre productos industriales"
        description="Artículos técnicos sobre desengrasantes, lubricantes, desinfectantes y limpieza industrial. Guías prácticas para elegir el producto correcto."
        canonical={`${SITE_URL}/blog`}
        type="website"
      />

      {/* Nav */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.borderLight}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/">
            <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 36 }} />
          </Link>
          <nav style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <Link to="/catalogo" style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textDecoration: 'none' }}>Catálogo</Link>
            <Link to="/blog" style={{ fontSize: 14, fontWeight: 700, color: C.accent, textDecoration: 'none' }}>Blog</Link>
            <Link to="/nosotros" style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, textDecoration: 'none' }}>Nosotros</Link>
            <Link to="/cotizar" style={{ fontSize: 14, fontWeight: 700, color: C.white, background: C.accent, padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>
              Cotizar
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ minHeight: '100vh', background: C.bg }}>
        {/* Hero */}
        <div style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, padding: '72px 24px 64px', textAlign: 'center', color: C.white }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
              Recursos técnicos
            </span>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: '12px 0 16px', lineHeight: 1.15 }}>
              Guías y artículos industriales
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.7, opacity: 0.85 }}>
              Contenido técnico para ayudarte a elegir el producto correcto, optimizar costos y mantener tus equipos e instalaciones en condiciones.
            </p>
          </div>
        </div>

        {/* Articles */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: C.textMuted, fontSize: 15 }}>
              Cargando artículos…
            </div>
          ) : articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: C.textMuted }}>
              No hay artículos publicados todavía.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {articles.map((a, i) => (
                <ArticleCard key={a.id} article={a} featured={i === 0} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer simple */}
      <footer style={{ background: C.dark, color: 'rgba(255,255,255,0.6)', padding: '32px 24px', textAlign: 'center', fontSize: 13 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          © {new Date().getFullYear()} FEMAVI — <Link to="/" style={{ color: C.accent, textDecoration: 'none' }}>Volver al sitio</Link>
        </div>
      </footer>
    </>
  );
}

function ArticleCard({ article: a, featured }: { article: Article; featured?: boolean }) {
  const date = a.published_at ? new Date(a.published_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  if (featured) {
    return (
      <Link to={`/blog/${a.slug}`} style={{ textDecoration: 'none' }}>
        <div style={{
          background: C.white, borderRadius: 20, border: `1px solid ${C.borderLight}`,
          overflow: 'hidden', transition: 'all 0.3s',
          boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 40px rgba(0,103,172,0.12)'; (e.currentTarget as HTMLDivElement).style.borderColor = C.accent; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 16px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = C.borderLight; }}
        >
          {a.cover_image_url && (
            <div style={{ height: 280, overflow: 'hidden', background: C.accentPale }}>
              <img src={a.cover_image_url} alt={a.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ padding: '32px 36px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {a.tags.slice(0, 3).map(t => (
                <span key={t} style={{ padding: '3px 10px', background: C.accentPale, borderRadius: 100, fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t}
                </span>
              ))}
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 26, fontWeight: 800, color: C.dark, margin: '0 0 12px', lineHeight: 1.25 }}>{a.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: C.textMuted, margin: '0 0 20px' }}>{a.excerpt}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted }}>
                <Calendar style={{ width: 13, height: 13 }} />
                {date}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, display: 'flex', alignItems: 'center', gap: 4 }}>
                Leer artículo <ArrowRight style={{ width: 14, height: 14 }} />
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/blog/${a.slug}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: C.white, borderRadius: 16, border: `1px solid ${C.borderLight}`,
        padding: '24px 28px', display: 'flex', gap: 24, alignItems: 'flex-start',
        transition: 'all 0.3s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.accent; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(0,103,172,0.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.borderLight; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
      >
        {a.cover_image_url && (
          <div style={{ width: 120, height: 90, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: C.accentPale }}>
            <img src={a.cover_image_url} alt={a.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {a.tags.slice(0, 2).map(t => (
              <span key={t} style={{ padding: '2px 8px', background: C.accentPale, borderRadius: 100, fontSize: 10, fontWeight: 700, color: C.accent, textTransform: 'uppercase' }}>
                {t}
              </span>
            ))}
          </div>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: C.dark, margin: '0 0 8px', lineHeight: 1.3 }}>{a.title}</h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textMuted, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {a.excerpt}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted }}>
            <Calendar style={{ width: 11, height: 11 }} />
            {date}
          </div>
        </div>
        <ArrowRight style={{ width: 16, height: 16, color: C.accent, flexShrink: 0, marginTop: 4 }} />
      </div>
    </Link>
  );
}
