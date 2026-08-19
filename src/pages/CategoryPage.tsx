import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { listArticles } from '../lib/articles';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { SEO, SITE_URL } from '../components/SEO';
import { getCategoryConfig, productoEnCategoria } from '../data/categoryConfigs';
import type { Product } from '../types/product';
import type { Article } from '../types/article';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', borderLight: '#e2e8ee',
  whatsapp: '#25D366',
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

export default function CategoryPage() {
  const { slug = '' } = useParams();
  const config = getCategoryConfig(slug);
  const { products, loading } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);

  useEffect(() => {
    document.body.style.background = C.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  useEffect(() => {
    if (!config) return;
    listArticles()
      .then(articles => setRelatedArticles(articles.filter(a => a.tags.includes(config.blogTag)).slice(0, 3)))
      .catch(() => setRelatedArticles([]));
  }, [config]);

  const categoryProducts = useMemo(() => {
    if (!config) return [];
    // Incluye las categorías adicionales del producto, no solo la primaria: un producto
    // puede listarse en más de una categoría (ver productoEnCategoria).
    return products.filter(p => productoEnCategoria(p, config));
  }, [products, config]);

  const url = `${SITE_URL}/catalogo/categoria/${slug}`;

  const jsonLd = useMemo(() => {
    if (!config) return undefined;
    const list = categoryProducts.slice(0, 24).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/catalogo/${p.slug}`,
      name: p.name,
    }));
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: config.seoTitle,
        description: config.seoDesc,
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE_URL}/catalogo` },
            { '@type': 'ListItem', position: 3, name: config.name, item: url },
          ],
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: config.name,
        numberOfItems: categoryProducts.length,
        itemListElement: list,
      },
    ];
  }, [config, categoryProducts, url]);

  if (!config) {
    return (
      <>
        <SEO
          title="Categoría no encontrada"
          description="La categoría que buscás no existe. Ver el catálogo completo de productos químicos industriales FEMAVI."
          canonical={url}
          noindex
        />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24 }}>
          <h1 style={{ fontSize: 28, color: C.dark, marginBottom: 12 }}>Categoría no encontrada</h1>
          <Link to="/catalogo" style={{ padding: '12px 24px', background: C.accent, color: C.white, borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>
            Ver catálogo completo →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title={config.seoTitle}
        description={config.seoDesc}
        canonical={url}
        type="website"
        jsonLd={jsonLd}
      />
      <Nav />

      <section style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.accent} 100%)`, padding: '72px 24px 64px', color: C.white }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{config.icon}</div>
          <nav aria-label="breadcrumb" style={{ fontSize: 12, opacity: 0.75, marginBottom: 14 }}>
            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Inicio</Link>
            <span style={{ margin: '0 8px' }}>›</span>
            <Link to="/catalogo" style={{ color: 'inherit', textDecoration: 'none' }}>Catálogo</Link>
            <span style={{ margin: '0 8px' }}>›</span>
            <span>{config.name}</span>
          </nav>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 20px', lineHeight: 1.15 }}>
            {config.heroTitle}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.7, opacity: 0.88, maxWidth: 680, margin: '0 auto 36px' }}>
            {config.heroDesc}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/cotizar" style={{ padding: '14px 32px', background: C.white, color: C.accent, fontWeight: 800, fontSize: 15, borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              Solicitar cotización →
            </Link>
            <a href={`https://wa.me/5491162284649?text=${encodeURIComponent(`Hola FEMAVI, necesito ${config.name.toLowerCase()}.`)}`} target="_blank" rel="noopener noreferrer"
              style={{ padding: '14px 28px', background: C.whatsapp, color: C.white, fontWeight: 700, fontSize: 15, borderRadius: 10, textDecoration: 'none' }}>
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section style={{ background: C.white, padding: '48px 24px', borderBottom: `1px solid ${C.borderLight}` }}>
        <p style={{ maxWidth: 760, margin: '0 auto', fontSize: 16, lineHeight: 1.8, color: C.textMuted, textAlign: 'center' }}>
          {config.intro}
        </p>
      </section>

      <section style={{ background: C.bg, padding: '64px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.accent }}>Catálogo</span>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, color: C.dark, margin: '10px 0 12px' }}>
              {loading ? 'Cargando productos…' : `${categoryProducts.length} producto${categoryProducts.length !== 1 ? 's' : ''} en ${config.name}`}
            </h2>
          </div>
          {categoryProducts.length > 0 ? (
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {categoryProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} onClick={setSelectedProduct} delay={Math.min(i * 0.05, 0.35)} />
              ))}
            </div>
          ) : !loading && (
            <p style={{ textAlign: 'center', color: C.textMuted }}>
              Próximamente vamos a sumar productos a esta categoría. Mientras tanto, <Link to="/catalogo" style={{ color: C.accent }}>ver catálogo completo</Link>.
            </p>
          )}
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <Link to={`/catalogo?tipo=${encodeURIComponent(config.subcategories[0])}`} style={{ display: 'inline-block', padding: '12px 28px', border: `2px solid ${C.accent}`, color: C.accent, fontWeight: 700, borderRadius: 10, textDecoration: 'none', fontSize: 14 }}>
              Ver en el catálogo completo con filtros
            </Link>
          </div>
        </div>
      </section>

      <section style={{ background: C.white, padding: '64px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
            {config.benefits.map(b => (
              <div key={b.title} style={{ padding: '28px 24px', border: `1px solid ${C.borderLight}`, borderRadius: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{b.icon}</div>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: C.dark, margin: '0 0 8px' }}>{b.title}</h3>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: 0 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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

      {config.faq.length > 0 && (
        <section style={{ background: C.bg, padding: '64px 24px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 800, color: C.dark, margin: '0 0 36px', textAlign: 'center' }}>
              Preguntas frecuentes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {config.faq.map(f => (
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

      {relatedArticles.length > 0 && (
        <section style={{ background: C.white, padding: '48px 24px', borderTop: `1px solid ${C.borderLight}` }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: '0 0 24px', textAlign: 'center' }}>
              Guías técnicas relacionadas
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {relatedArticles.map(a => (
                <Link key={a.slug} to={`/blog/${a.slug}`} style={{ padding: '16px 20px', border: `1px solid ${C.borderLight}`, borderRadius: 10, textDecoration: 'none', color: C.dark, fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg }}>
                  {a.title}
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

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </>
  );
}
