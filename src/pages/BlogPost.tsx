import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft, Tag } from 'lucide-react';
import { marked } from 'marked';
import { getArticleBySlug } from '../lib/articles';
import { SEO, SITE_URL } from '../components/SEO';
import type { Article } from '../types/article';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', borderLight: '#e2e8ee',
};

marked.setOptions({ breaks: true });

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.body.style.background = C.bg;
    if (!slug) { navigate('/blog'); return; }
    getArticleBySlug(slug)
      .then(a => {
        if (!a) setNotFound(true);
        else setArticle(a);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    return () => { document.body.style.background = ''; };
  }, [slug, navigate]);

  const date = article?.published_at
    ? new Date(article.published_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const htmlContent = article?.content ? marked(article.content) as string : '';

  return (
    <>
      {article && (
        <SEO
          title={`${article.title} — FEMAVI`}
          description={article.excerpt}
          canonical={`${SITE_URL}/blog/${article.slug}`}
          type="article"
          image={article.cover_image_url ?? undefined}
        />
      )}

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

      <main style={{ minHeight: '100vh', background: C.bg, padding: '48px 24px 80px' }}>
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <Link to="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.textMuted, textDecoration: 'none', marginBottom: 32 }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Volver al blog
          </Link>

          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: C.textMuted }}>Cargando…</div>
          )}

          {notFound && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 24, color: C.dark, marginBottom: 12 }}>Artículo no encontrado</h2>
              <Link to="/blog" style={{ color: C.accent, fontWeight: 700, textDecoration: 'none' }}>Ver todos los artículos →</Link>
            </div>
          )}

          {article && (
            <article>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {article.tags.map(t => (
                  <span key={t} style={{ padding: '3px 10px', background: C.accentPale, borderRadius: 100, fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Tag style={{ width: 9, height: 9 }} /> {t}
                  </span>
                ))}
              </div>

              {/* Title */}
              <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: C.dark, margin: '0 0 16px', lineHeight: 1.2 }}>
                {article.title}
              </h1>

              {/* Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMuted, marginBottom: 28, paddingBottom: 28, borderBottom: `1px solid ${C.borderLight}` }}>
                <Calendar style={{ width: 14, height: 14 }} />
                {date}
              </div>

              {/* Cover */}
              {article.cover_image_url && (
                <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 40, maxHeight: 420 }}>
                  <img src={article.cover_image_url} alt={article.title} style={{ width: '100%', objectFit: 'cover' }} />
                </div>
              )}

              {/* Excerpt */}
              <p style={{ fontSize: 17, lineHeight: 1.8, color: C.text, fontWeight: 500, marginBottom: 32, padding: '20px 24px', background: C.accentPale, borderLeft: `3px solid ${C.accent}`, borderRadius: '0 12px 12px 0' }}>
                {article.excerpt}
              </p>

              {/* Content */}
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                style={{ fontSize: 16, lineHeight: 1.85, color: C.text }}
              />

              {/* CTA */}
              <div style={{ marginTop: 56, padding: '36px', background: `linear-gradient(135deg, ${C.dark}, ${C.accent})`, borderRadius: 20, textAlign: 'center', color: C.white }}>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>
                  ¿Necesitás el producto adecuado para tu operación?
                </h3>
                <p style={{ fontSize: 15, opacity: 0.85, margin: '0 0 24px' }}>
                  Cotizá directo desde el catálogo o consultanos para una recomendación a medida.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link to="/catalogo" style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.15)', color: C.white, fontWeight: 700, fontSize: 14, borderRadius: 10, textDecoration: 'none', backdropFilter: 'blur(4px)' }}>
                    Ver catálogo
                  </Link>
                  <Link to="/cotizar" style={{ padding: '12px 24px', background: C.white, color: C.accent, fontWeight: 700, fontSize: 14, borderRadius: 10, textDecoration: 'none' }}>
                    Solicitar cotización
                  </Link>
                </div>
              </div>
            </article>
          )}
        </div>
      </main>

      <footer style={{ background: C.dark, color: 'rgba(255,255,255,0.6)', padding: '32px 24px', textAlign: 'center', fontSize: 13 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          © {new Date().getFullYear()} FEMAVI — <Link to="/" style={{ color: C.accent, textDecoration: 'none' }}>Volver al sitio</Link>
        </div>
      </footer>
    </>
  );
}
