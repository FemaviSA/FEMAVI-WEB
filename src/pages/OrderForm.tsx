import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setCartMode } from '../lib/cartMode';
import { Trash2, ShoppingCart, ArrowLeft, CheckCircle2, Loader2, Package } from 'lucide-react';
import { useQuoteCart } from '../hooks/useQuoteCart';
import { useProducts } from '../hooks/useProducts';
import { createOrder } from '../lib/orders';
import { SEO, SITE_URL } from '../components/SEO';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentDark: '#004370', accentMuted: 'rgba(0,103,172,0.07)',
  dark: '#003058', text: '#1a2b3c', textMuted: '#5a6f80',
  textLight: '#8899a8', borderLight: '#e2e8ee',
  border: 'rgba(0,103,172,0.15)', whatsapp: '#25D366',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', background: C.white,
  border: `1px solid ${C.borderLight}`, borderRadius: 10,
  color: C.text, fontSize: 15, fontFamily: "'DM Sans', sans-serif",
  outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
};

const smallInputStyle: React.CSSProperties = {
  padding: '7px 10px', background: C.white,
  border: `1px solid ${C.borderLight}`, borderRadius: 7,
  color: C.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
  outline: 'none', boxSizing: 'border-box',
};

interface ProductDetail { presentation: string; quantity: number; }

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

export default function OrderForm() {
  const navigate = useNavigate();
  const { slugs, remove, clear } = useQuoteCart();
  const { products, loading: loadingProducts } = useProducts();

  const [form, setForm] = useState({
    client_name: '', email: '', phone: '', company: '', client_code: '', delivery_address: '', notes: '',
  });
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.body.style.background = C.bg; return () => { document.body.style.background = ''; }; }, []);

  const cartProducts = useMemo(() => products.filter(p => slugs.includes(p.slug)), [products, slugs]);

  useEffect(() => {
    if (cartProducts.length === 0) return;
    setProductDetails(prev => {
      const next = { ...prev };
      for (const p of cartProducts) {
        if (!next[p.slug]) next[p.slug] = { presentation: p.presentations?.[0] ?? '', quantity: 1 };
      }
      return next;
    });
  }, [cartProducts]);

  useEffect(() => {
    if (loadingProducts || products.length === 0) return;
    const valid = new Set(products.map(p => p.slug));
    slugs.filter(s => !valid.has(s)).forEach(s => remove(s));
  }, [loadingProducts, products, slugs, remove]);

  const setField = (f: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));

  const setPresentation = (slug: string, presentation: string) =>
    setProductDetails(p => ({ ...p, [slug]: { ...p[slug], presentation } }));

  const setQuantity = (slug: string, quantity: number) =>
    setProductDetails(p => ({ ...p, [slug]: { ...p[slug], quantity: Math.max(1, quantity) } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const items = cartProducts.map(p => ({
        product: p.name,
        slug: p.slug,
        presentation: productDetails[p.slug]?.presentation ?? p.presentations?.[0] ?? '',
        quantity: productDetails[p.slug]?.quantity ?? 1,
      }));
      await createOrder({
        client_name: form.client_name,
        client_code: form.client_code || null,
        email: form.email,
        phone: form.phone,
        company: form.company,
        delivery_address: form.delivery_address,
        notes: form.notes || null,
        items,
      });
      // Fire-and-forget email notification
      fetch('https://lhqawwjszwjzxxsonvwa.supabase.co/functions/v1/send-order-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocWF3d2pzendqenh4c29udndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTQ2NDMsImV4cCI6MjA5MjU5MDY0M30.3Dx6c3mLwqGDgRfQK4mn70ohuSZ5GXV7WvrtlV6A0DM',
        },
        body: JSON.stringify({
          client_name: form.client_name,
          client_code: form.client_code || null,
          email: form.email,
          phone: form.phone,
          company: form.company,
          delivery_address: form.delivery_address,
          notes: form.notes || null,
          items,
        }),
      }).catch(() => { /* non-critical */ });
      setSubmitted(true);
      clear();
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos enviar el pedido. Intentá de nuevo o escribinos por WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <SEO title="Pedido enviado — FEMAVI" description="" canonical={SITE_URL + '/pedidos'} noindex />
        <Nav />
        <main style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 540, textAlign: 'center', background: C.white, padding: 56, borderRadius: 24, border: `1px solid ${C.borderLight}`, boxShadow: '0 16px 48px rgba(0,67,112,0.06)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: '#10b981' }} />
            </div>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 32, fontWeight: 800, color: C.dark, margin: '0 0 12px' }}>¡Pedido recibido!</h1>
            <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.7, margin: '0 0 32px' }}>
              Recibimos tu pedido. Nuestro equipo lo va a procesar y te confirma a la brevedad.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/catalogo" style={{ padding: '14px 28px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none' }}>Volver al catálogo</Link>
              <Link to="/" style={{ padding: '14px 28px', background: C.white, color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none', border: `1.5px solid ${C.border}` }}>Ir al inicio</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (cartProducts.length === 0 && !loadingProducts) {
    return (
      <>
        <SEO title="Hacer pedido — FEMAVI" description="" canonical={SITE_URL + '/pedidos'} noindex />
        <Nav />
        <main style={{ minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: C.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Package style={{ width: 36, height: 36, color: C.accent }} />
            </div>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 32, fontWeight: 800, color: C.dark, margin: '0 0 12px' }}>Tu pedido está vacío</h1>
            <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.7, margin: '0 0 32px' }}>
              Andá al catálogo, agregá los productos que necesitás y volvé acá para confirmar el pedido.
            </p>
            <button onClick={() => { setCartMode('pedido'); navigate('/catalogo'); }} style={{ display: 'inline-block', padding: '14px 32px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 8px 20px rgba(0,103,172,0.2)' }}>
              Ir al catálogo →
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Hacer pedido — FEMAVI"
        description="Clientes FEMAVI: confirmá tu pedido directamente."
        canonical={SITE_URL + '/pedidos'}
        noindex
      />
      <Nav />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: C.accentMuted, borderRadius: 100, border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <Package style={{ width: 12, height: 12, color: C.accent }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Zona de clientes</span>
          </div>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 40, fontWeight: 800, color: C.dark, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Tu pedido</h1>
          <p style={{ fontSize: 16, color: C.textMuted, margin: 0 }}>
            {cartProducts.length} producto{cartProducts.length !== 1 ? 's' : ''} seleccionado{cartProducts.length !== 1 ? 's' : ''}. Completá tus datos y confirmamos el pedido a la brevedad.
          </p>
        </div>

        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32, alignItems: 'start' }}>
          {/* Formulario de datos */}
          <form onSubmit={handleSubmit} style={{ background: C.white, padding: 32, borderRadius: 20, border: `1px solid ${C.borderLight}`, boxShadow: '0 8px 24px rgba(0,67,112,0.04)' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: '0 0 8px' }}>Tus datos</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 24px' }}>Todos los campos son obligatorios salvo el código de cliente y las observaciones.</p>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre y apellido *</label>
                <input required style={inputStyle} value={form.client_name} onChange={setField('client_name')} placeholder="Tu nombre" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razón social *</label>
                <input required style={inputStyle} value={form.company} onChange={setField('company')} placeholder="Nombre de la empresa" />
              </div>
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email *</label>
                <input required type="email" style={inputStyle} value={form.email} onChange={setField('email')} placeholder="tu@empresa.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teléfono *</label>
                <input required style={inputStyle} value={form.phone} onChange={setField('phone')} placeholder="+54 11 …" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dirección de entrega *</label>
              <input required style={inputStyle} value={form.delivery_address} onChange={setField('delivery_address')} placeholder="Calle, número, localidad, provincia" />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código de cliente</label>
              <input style={inputStyle} value={form.client_code} onChange={setField('client_code')} placeholder="Si lo tenés" />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observaciones</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={form.notes} onChange={setField('notes')} placeholder="Horario de entrega, instrucciones especiales, etc." />
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
                width: '100%', padding: 16,
                background: submitting ? C.textLight : C.accent,
                color: C.white, fontSize: 16, fontWeight: 700, borderRadius: 10,
                border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: submitting ? 'none' : '0 8px 20px rgba(0,103,172,0.25)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null}
              {submitting ? 'Enviando…' : `Confirmar pedido (${cartProducts.length} producto${cartProducts.length !== 1 ? 's' : ''})`}
            </button>
            <p style={{ fontSize: 12, color: C.textLight, textAlign: 'center', marginTop: 14 }}>
              Lo procesamos y te confirmamos por teléfono o email a la brevedad.
            </p>
          </form>

          {/* Resumen de productos */}
          <aside style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.borderLight}`, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,67,112,0.04)' }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: C.dark, margin: 0 }}>Productos del pedido</h2>
                {cartProducts.length > 1 && (
                  <button type="button" onClick={() => { if (confirm('¿Vaciar el pedido?')) clear(); }} style={{ background: 'none', border: 'none', color: C.textLight, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}>
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
                          <ShoppingCart style={{ width: 18, height: 18, color: C.accent }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category}</div>
                          <Link to={`/catalogo/${p.slug}`} style={{ fontSize: 13, fontWeight: 700, color: C.dark, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</Link>
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
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        {p.presentations && p.presentations.length > 1 ? (
                          <select value={detail.presentation} onChange={e => setPresentation(p.slug, e.target.value)} style={{ ...smallInputStyle, flex: 1, cursor: 'pointer' }}>
                            {p.presentations.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                          </select>
                        ) : (
                          <span style={{ flex: 1, fontSize: 12, color: C.textMuted, padding: '7px 0' }}>{detail.presentation || '—'}</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <button type="button" onClick={() => setQuantity(p.slug, detail.quantity - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.borderLight}`, background: C.bg, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>−</button>
                          <input type="number" min={1} value={detail.quantity} onChange={e => setQuantity(p.slug, parseInt(e.target.value) || 1)} style={{ ...smallInputStyle, width: 46, textAlign: 'center', padding: '7px 4px' }} />
                          <button type="button" onClick={() => setQuantity(p.slug, detail.quantity + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.borderLight}`, background: C.bg, color: C.text, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>+</button>
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
              <p style={{ fontSize: 14, color: C.text, margin: '0 0 12px', lineHeight: 1.5 }}>Llamanos al <strong>11-6228-4649</strong> o escribinos por WhatsApp.</p>
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
