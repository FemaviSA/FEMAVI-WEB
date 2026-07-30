import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ShoppingCart, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useQuoteCart } from '../hooks/useQuoteCart';
import { useProducts } from '../hooks/useProducts';
import { createQuote } from '../lib/quotes';
import { sendQuoteNotification } from '../lib/email';
import { SEO, SITE_URL } from '../components/SEO';

const C = {
  bg: '#f6f8fa',
  white: '#FFFFFF',
  accent: '#0067ac',
  accentLight: '#0080d4',
  accentDark: '#004370',
  accentMuted: 'rgba(0,103,172,0.07)',
  dark: '#003058',
  darkDeep: '#001c33',
  text: '#1a2b3c',
  textMuted: '#5a6f80',
  textLight: '#8899a8',
  borderLight: '#e2e8ee',
  border: 'rgba(0,103,172,0.15)',
  whatsapp: '#25D366',
};

const RUBROS = ['Transporte', 'Gastronomía', 'Edificios / Consorcios', 'Industria / Manufactura', 'Empresa de Limpieza', 'Salud', 'Educación', 'Otro'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  background: C.white,
  border: `1px solid ${C.borderLight}`,
  borderRadius: 10,
  color: C.text,
  fontSize: 15,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
};

const smallInputStyle: React.CSSProperties = {
  padding: '7px 10px',
  background: C.white,
  border: `1px solid ${C.borderLight}`,
  borderRadius: 7,
  color: C.text,
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
};

function Nav() {
  return (
    <nav style={{ background: C.white, borderBottom: `1px solid ${C.borderLight}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 40, width: 'auto' }} />
        </Link>
        <Link to="/catalogo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textMuted, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> Volver al catálogo
        </Link>
      </div>
    </nav>
  );
}

interface ProductDetail {
  presentation: string;
  quantity: number;
}

export default function Quote() {
  const { slugs, remove, clear } = useQuoteCart();
  const { products, loading: loadingProducts } = useProducts();

  const [form, setForm] = useState({
    nombre: '', email: '', telefono: '', empresa: '', rubro: '', mensaje: '',
  });
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.background = C.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  const cartProducts = useMemo(
    () => products.filter(p => slugs.includes(p.slug)),
    [products, slugs]
  );

  // Inicializa productDetails cuando se cargan los productos del carrito
  useEffect(() => {
    if (cartProducts.length === 0) return;
    setProductDetails(prev => {
      const next = { ...prev };
      for (const p of cartProducts) {
        if (!next[p.slug]) {
          next[p.slug] = {
            presentation: p.presentations?.[0] ?? '',
            quantity: 1,
          };
        }
      }
      return next;
    });
  }, [cartProducts]);

  // Limpia slugs huérfanos (productos borrados/desactivados después de agregar)
  useEffect(() => {
    if (loadingProducts || products.length === 0) return;
    const validSlugs = new Set(products.map(p => p.slug));
    const stale = slugs.filter(s => !validSlugs.has(s));
    if (stale.length > 0) {
      stale.forEach(s => remove(s));
    }
  }, [loadingProducts, products, slugs, remove]);

  const setField = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setProductPresentation = (slug: string, presentation: string) => {
    setProductDetails(prev => ({ ...prev, [slug]: { ...prev[slug], presentation } }));
  };

  const setProductQuantity = (slug: string, quantity: number) => {
    setProductDetails(prev => ({ ...prev, [slug]: { ...prev[slug], quantity: Math.max(1, quantity) } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createQuote({
        name: form.nombre,
        email: form.email,
        phone: form.telefono || null,
        company: form.empresa || null,
        industry: form.rubro || null,
        message: form.mensaje || null,
        product_slugs: slugs,
        product_details: cartProducts.map(p => ({
          slug: p.slug,
          presentation: productDetails[p.slug]?.presentation ?? p.presentations?.[0] ?? '',
          quantity: productDetails[p.slug]?.quantity ?? 1,
        })),
      });

      // Dispara email con planilla Excel (fire-and-forget)
      sendQuoteNotification({
        name: form.nombre,
        email: form.email,
        phone: form.telefono || null,
        company: form.empresa || null,
        industry: form.rubro || null,
        message: form.mensaje || null,
        productNames: cartProducts.map(p => p.name),
        productDetails: cartProducts.map(p => ({
          name: p.name,
          slug: p.slug,
          presentation: productDetails[p.slug]?.presentation ?? p.presentations?.[0] ?? '',
          quantity: productDetails[p.slug]?.quantity ?? 1,
        })),
      });

      setSubmitted(true);
      clear();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos enviar la consulta. Probá de nuevo o escribinos por WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  // Estado: cotización enviada
  if (submitted) {
    return (
      <>
        <SEO
          title="Cotización enviada — FEMAVI"
          description="Recibimos tu solicitud de cotización. Un representante comercial se va a comunicar con vos en menos de 24 horas hábiles."
          canonical={SITE_URL + '/cotizar'}
          noindex
        />
        <Nav />
        <main style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 540, textAlign: 'center', background: C.white, padding: 56, borderRadius: 24, border: `1px solid ${C.borderLight}`, boxShadow: '0 16px 48px rgba(0,67,112,0.06)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: '#10b981' }} />
            </div>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 32, fontWeight: 800, color: C.dark, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              ¡Recibimos tu solicitud!
            </h1>
            <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.7, margin: '0 0 32px' }}>
              Un representante comercial se va a comunicar con vos en menos de <strong style={{ color: C.dark }}>24 horas hábiles</strong> con la cotización adaptada a tu volumen.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/catalogo" style={{ padding: '14px 28px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none' }}>
                Volver al catálogo
              </Link>
              <Link to="/" style={{ padding: '14px 28px', background: C.white, color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none', border: `1.5px solid ${C.border}` }}>
                Ir al inicio
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Estado: cart vacío
  if (cartProducts.length === 0 && !loadingProducts) {
    return (
      <>
        <SEO
          title="Pedir cotización — FEMAVI"
          description="Armá tu cotización seleccionando productos del catálogo de FEMAVI."
          canonical={SITE_URL + '/cotizar'}
          noindex
        />
        <Nav />
        <main style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: C.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <ShoppingCart style={{ width: 36, height: 36, color: C.accent }} />
            </div>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 32, fontWeight: 800, color: C.dark, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Tu cotización está vacía
            </h1>
            <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.7, margin: '0 0 32px' }}>
              Andá al catálogo y agregá los productos que te interesan. Después volvé acá para enviar la consulta con tus datos.
            </p>
            <Link to="/catalogo" style={{ display: 'inline-block', padding: '14px 32px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none', boxShadow: '0 8px 20px rgba(0,103,172,0.2)' }}>
              Explorar productos →
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Pedir cotización — FEMAVI"
        description={`Solicitá cotización para ${cartProducts.length} producto${cartProducts.length !== 1 ? 's' : ''} de FEMAVI. Te respondemos en menos de 24 horas hábiles con una propuesta adaptada a tu volumen.`}
        canonical={SITE_URL + '/cotizar'}
        noindex
      />
      <Nav />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cotización</span>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 40, fontWeight: 800, color: C.dark, letterSpacing: '-0.02em', margin: '8px 0 8px' }}>
            Tu solicitud
          </h1>
          <p style={{ fontSize: 16, color: C.textMuted, margin: 0 }}>
            {cartProducts.length} producto{cartProducts.length !== 1 ? 's' : ''} seleccionado{cartProducts.length !== 1 ? 's' : ''}. Completá tus datos y nuestro equipo comercial te contesta con una cotización a medida.
          </p>
        </div>

        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32, alignItems: 'start' }}>
          {/* Form */}
          <form onSubmit={handleSubmit} style={{ background: C.white, padding: 32, borderRadius: 20, border: `1px solid ${C.borderLight}`, boxShadow: '0 8px 24px rgba(0,67,112,0.04)' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: '0 0 8px' }}>Tus datos de contacto</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 24px' }}>Los campos con * son obligatorios.</p>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre *</label>
                <input required style={inputStyle} value={form.nombre} onChange={setField('nombre')} placeholder="Tu nombre y apellido" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email *</label>
                <input required type="email" style={inputStyle} value={form.email} onChange={setField('email')} placeholder="tu@empresa.com" />
              </div>
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teléfono</label>
                <input style={inputStyle} value={form.telefono} onChange={setField('telefono')} placeholder="+54 11 …" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa</label>
                <input style={inputStyle} value={form.empresa} onChange={setField('empresa')} placeholder="Nombre de tu empresa" />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rubro</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.rubro} onChange={setField('rubro')}>
                <option value="">Seleccioná tu rubro</option>
                {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mensaje (opcional)</label>
              <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={form.mensaje} onChange={setField('mensaje')} placeholder="Volúmenes estimados, frecuencia de compra, dudas técnicas, etc." />
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, fontSize: 14 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '16px',
                background: submitting ? C.textLight : C.accent,
                color: C.white, fontSize: 16, fontWeight: 700, borderRadius: 10,
                border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: submitting ? 'none' : '0 8px 20px rgba(0,103,172,0.25)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null}
              {submitting ? 'Enviando…' : `Enviar solicitud de cotización (${cartProducts.length} producto${cartProducts.length !== 1 ? 's' : ''})`}
            </button>
            <p style={{ fontSize: 12, color: C.textLight, textAlign: 'center', marginTop: 14 }}>
              Te respondemos en menos de 24 horas hábiles. Sin compromiso.
            </p>
          </form>

          {/* Resumen sticky */}
          <aside style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.borderLight}`, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,67,112,0.04)' }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: C.dark, margin: 0 }}>
                  Productos seleccionados
                </h2>
                {cartProducts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => { if (confirm('¿Vaciar tu cotización?')) clear(); }}
                    style={{ background: 'none', border: 'none', color: C.textLight, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Vaciar
                  </button>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 540, overflowY: 'auto' }}>
                {cartProducts.map(p => {
                  const detail = productDetails[p.slug] ?? { presentation: p.presentations?.[0] ?? '', quantity: 1 };
                  return (
                    <li key={p.slug} style={{ padding: '14px 20px', borderBottom: `1px solid ${C.borderLight}` }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: C.bg, border: `1px solid ${C.borderLight}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {p.image_url && <img src={p.image_url} alt={p.name} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category}</div>
                          <Link to={`/catalogo/${p.slug}`} style={{ fontSize: 13, fontWeight: 700, color: C.dark, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </Link>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(p.slug)}
                          aria-label={`Quitar ${p.name}`}
                          style={{ width: 28, height: 28, borderRadius: 7, background: C.bg, border: `1px solid ${C.borderLight}`, color: C.textLight, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.textLight; e.currentTarget.style.borderColor = C.borderLight; }}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>

                      {/* Presentación y cantidad */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        {p.presentations && p.presentations.length > 1 ? (
                          <select
                            value={detail.presentation}
                            onChange={e => setProductPresentation(p.slug, e.target.value)}
                            style={{ ...smallInputStyle, flex: 1, cursor: 'pointer' }}
                          >
                            {p.presentations.map(pres => (
                              <option key={pres} value={pres}>{pres}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ flex: 1, fontSize: 12, color: C.textMuted, padding: '7px 0' }}>
                            {detail.presentation || '—'}
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setProductQuantity(p.slug, detail.quantity - 1)}
                            style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.borderLight}`, background: C.bg, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}
                          >−</button>
                          <input
                            type="number"
                            min={1}
                            value={detail.quantity}
                            onChange={e => setProductQuantity(p.slug, parseInt(e.target.value) || 1)}
                            style={{ ...smallInputStyle, width: 46, textAlign: 'center', padding: '7px 4px' }}
                          />
                          <button
                            type="button"
                            onClick={() => setProductQuantity(p.slug, detail.quantity + 1)}
                            style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.borderLight}`, background: C.bg, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}
                          >+</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div style={{ padding: '16px 20px', background: C.bg, fontSize: 13, color: C.textMuted }}>
                ¿Falta algún producto?{' '}
                <Link to="/catalogo" style={{ color: C.accent, fontWeight: 700, textDecoration: 'none' }}>Volver al catálogo →</Link>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 20, background: C.accentMuted, borderRadius: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📞 ¿Preferís hablar?</div>
              <p style={{ fontSize: 14, color: C.text, margin: '0 0 12px', lineHeight: 1.5 }}>
                Llamanos al <strong>11-6228-4649</strong> o escribinos por WhatsApp.
              </p>
              <a href="https://wa.me/5491162284649" target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.whatsapp, color: C.white, fontSize: 13, fontWeight: 700, borderRadius: 8, textDecoration: 'none' }}>
                💬 Abrir WhatsApp
              </a>
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </>
  );
}
