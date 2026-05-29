import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProductBySlug } from '../lib/products';
import { SEO, SITE_URL } from '../components/SEO';
import { AddToQuoteButton } from '../components/AddToQuoteButton';
import type { Product } from '../types/product';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', textLight: '#8899a8',
  borderLight: '#e2e8ee', whatsapp: '#25D366',
};

export default function ProductPage() {
  const { slug = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.body.style.background = C.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    getProductBySlug(slug)
      .then(p => {
        if (!p) setNotFound(true);
        setProduct(p);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.textMuted }}>
        Cargando…
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <>
        <SEO
          title="Producto no encontrado"
          description="El producto que buscás no existe o fue retirado del catálogo. Ver todos los productos químicos industriales FEMAVI."
          canonical={`${SITE_URL}/catalogo/${slug}`}
          noindex
        />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24 }}>
          <h1 style={{ fontSize: 28, color: C.dark, marginBottom: 12 }}>Producto no encontrado</h1>
          <p style={{ color: C.textMuted, marginBottom: 24 }}>El producto que buscás no existe o fue retirado.</p>
          <Link to="/catalogo" style={{ padding: '12px 24px', background: C.accent, color: C.white, borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>
            Ver catálogo completo →
          </Link>
        </div>
      </>
    );
  }

  const url = `${SITE_URL}/catalogo/${product.slug}`;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    description: product.description,
    image: product.image_url ? [product.image_url] : undefined,
    sku: product.slug,
    category: product.category,
    brand: { '@type': 'Brand', name: 'FEMAVI' },
    manufacturer: { '@id': `${SITE_URL}/#organization` },
    additionalProperty: [
      product.dilution && { '@type': 'PropertyValue', name: 'Dilución', value: product.dilution },
      product.ph && { '@type': 'PropertyValue', name: 'pH', value: product.ph },
      product.presentations.length > 0 && { '@type': 'PropertyValue', name: 'Presentaciones', value: product.presentations.join(', ') },
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'ARS',
      availability: 'https://schema.org/InStock',
      url,
      seller: { '@id': `${SITE_URL}/#organization` },
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE_URL}/catalogo` },
      { '@type': 'ListItem', position: 3, name: product.name, item: url },
    ],
  };

  const seoTitle = `${product.name} — ${product.category} industrial argentino | FEMAVI`;
  const seoDescription = product.headline
    ? `${product.headline}. ${product.description.slice(0, 120)}`
    : product.description.slice(0, 160);

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={url}
        image={product.image_url ?? undefined}
        type="product.item"
        jsonLd={[productJsonLd, breadcrumbJsonLd]}
      />

      <nav style={{ position: 'sticky', top: 0, zIndex: 1000, background: C.white, borderBottom: `1px solid ${C.borderLight}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 64, width: 'auto' }} />
          </Link>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Link to="/catalogo" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>← Catálogo</Link>
            <Link to="/nosotros" style={{ color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Nosotros</Link>
            <a href="https://wa.me/5491162284649" target="_blank" rel="noopener" style={{ padding: '10px 22px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none' }}>Pedir Cotización</a>
          </div>
        </div>
      </nav>

      <nav aria-label="breadcrumb" style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 0', fontSize: 13, color: C.textMuted }}>
        <Link to="/" style={{ color: C.textMuted, textDecoration: 'none' }}>Inicio</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <Link to="/catalogo" style={{ color: C.textMuted, textDecoration: 'none' }}>Catálogo</Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: C.text }}>{product.category}</span>
      </nav>

      <article style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div className="modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'start' }}>
          <div style={{ background: `linear-gradient(160deg, ${C.accentPale}, ${C.bg})`, borderRadius: 24, padding: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            {product.image_url && <img src={product.image_url} alt={`${product.name} — ${product.category} FEMAVI`} style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }} />}
          </div>

          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{product.category}</span>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 40, fontWeight: 800, color: C.dark, margin: '8px 0 12px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {product.name}
            </h1>
            {product.headline && (
              <p style={{ fontSize: 18, color: C.textMuted, fontStyle: 'italic', margin: '0 0 24px', lineHeight: 1.5 }}>
                {product.headline}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
              {product.benefits.map(b => (
                <span key={b} style={{ padding: '6px 14px', background: C.accent, borderRadius: 100, fontSize: 12, color: C.white, fontWeight: 600 }}>{b}</span>
              ))}
            </div>

            <h2 style={{ fontSize: 14, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Descripción</h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: C.text, margin: '0 0 24px' }}>{product.description}</p>

            {product.story && (
              <div style={{ padding: '20px 24px', background: C.accentPale, borderRadius: 12, borderLeft: `3px solid ${C.accent}`, marginBottom: 28 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  La historia detrás del producto
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: C.textMuted, margin: 0 }}>{product.story}</p>
              </div>
            )}

            <h2 style={{ fontSize: 14, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Datos técnicos</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 32 }}>
              {([
                ['Dilución', product.dilution ?? '—'],
                ['pH', product.ph ?? '—'],
                ['Industrias', product.industries.join(', ')],
                ['Presentaciones', product.presentations.join(', ')],
              ] as const).map(([label, value]) => (
                <div key={label} style={{ padding: '12px 16px', background: C.white, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>
                  <dt style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</dt>
                  <dd style={{ fontSize: 14, color: C.text, fontWeight: 500, margin: 0 }}>{value}</dd>
                </div>
              ))}
            </dl>

            <div style={{ marginBottom: 12 }}>
              <AddToQuoteButton slug={product.slug} fullWidth size="lg" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to="/cotizar" style={{ flex: 1, padding: '16px 0', background: C.accent, color: C.white, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', textAlign: 'center' }}>
                Cotizar ahora →
              </Link>
              <a
                href={`https://wa.me/5491162284649?text=${encodeURIComponent('Hola, quiero consultar por ' + product.name)}`}
                target="_blank"
                rel="noopener"
                style={{ flex: 1, padding: '16px 0', background: C.whatsapp, color: C.white, fontSize: 15, fontWeight: 700, borderRadius: 10, textDecoration: 'none', textAlign: 'center' }}
              >
                💬 WhatsApp
              </a>
            </div>
          </div>
        </div>

        <section style={{ marginTop: 80, padding: '48px 0', borderTop: `1px solid ${C.borderLight}` }}>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 24, fontWeight: 800, color: C.dark, marginBottom: 16 }}>
            ¿Necesitás más información?
          </h2>
          <p style={{ fontSize: 16, color: C.textMuted, marginBottom: 24, lineHeight: 1.6, maxWidth: 600 }}>
            Pedí ficha técnica, MSDS o cotización por volumen. Nuestro equipo comercial responde en menos de 24 horas hábiles.
          </p>
          <Link to="/catalogo" style={{ display: 'inline-block', padding: '12px 24px', border: `2px solid ${C.accent}`, color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none' }}>
            Ver más productos →
          </Link>
        </section>
      </article>
    </>
  );
}
