import { useState, useEffect, useRef } from 'react';
import type { Product } from '../types/product';
import { useQuoteCart } from '../hooks/useQuoteCart';
import { getCartMode } from '../lib/cartMode';
import { Check, Plus, Eye } from 'lucide-react';
import { ProductLabel } from './ProductLabel';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', borderLight: '#e2e8ee',
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

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, v] = useInView();
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(20px)', transition: `all 0.55s ease ${delay}s` }}>
      {children}
    </div>
  );
}

type Props = {
  product: Product;
  onClick: (p: Product) => void;
  delay?: number;
};

export function ProductCard({ product: p, onClick, delay = 0 }: Props) {
  const [h, setH] = useState(false);
  const { has, toggle } = useQuoteCart();
  const inCart = has(p.slug);
  const mode = getCartMode();
  const quoteMode = mode === 'cotizacion' || mode === 'pedido';
  const addLabel = mode === 'pedido' ? 'Agregar al pedido' : 'Agregar a la cotización';
  const addedLabel = mode === 'pedido' ? 'Agregado al pedido' : 'Agregado a la cotización';
  return (
    <FadeIn delay={delay}>
      <div
        onClick={() => onClick(p)}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        style={{
          background: C.white, borderRadius: 16,
          border: `1px solid ${h ? C.accent : C.borderLight}`,
          overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s ease',
          transform: h ? 'translateY(-5px)' : 'none',
          boxShadow: h ? '0 20px 48px rgba(0,103,172,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ padding: '28px 24px 20px', display: 'flex', justifyContent: 'center', background: h ? C.accentPale : C.bg, transition: 'all 0.3s', position: 'relative' }}>
          {p.featured && (
            <span style={{ position: 'absolute', top: 12, left: 12, padding: '3px 10px', background: C.accent, color: C.white, fontSize: 10, fontWeight: 700, borderRadius: 6, textTransform: 'uppercase' }}>
              Destacado
            </span>
          )}
          {p.tags.includes('Nuevo') && (
            <span style={{ position: 'absolute', top: 12, right: 12, padding: '3px 10px', background: '#f59e0b', color: C.white, fontSize: 10, fontWeight: 700, borderRadius: 6, textTransform: 'uppercase' }}>
              Nuevo
            </span>
          )}
          <div style={{ transition: 'transform 0.35s', transform: h ? 'scale(1.06)' : 'scale(1)' }}>
            <ProductLabel name={p.name} category={p.category} size={120} />
          </div>
        </div>
        <div style={{ padding: '0 22px 22px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.category}</span>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: C.dark, margin: '4px 0 6px' }}>{p.name}</h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textMuted, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {p.headline || p.description}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
            {p.industries.slice(0, 3).map(ind => (
              <span key={ind} style={{ padding: '2px 8px', background: C.accentPale, borderRadius: 100, fontSize: 10, color: C.accent, fontWeight: 600 }}>{ind}</span>
            ))}
          </div>
          {quoteMode ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(p.slug); }}
                aria-label={inCart ? 'Quitar de la cotización' : 'Agregar a la cotización'}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  background: inCart ? '#10b981' : C.accent,
                  color: C.white, fontSize: 13, fontWeight: 700, borderRadius: 8,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {inCart ? <Check style={{ width: 15, height: 15 }} /> : <Plus style={{ width: 15, height: 15 }} />}
                {inCart ? addedLabel : addLabel}
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(p); }}
                aria-label="Ver detalle"
                style={{
                  width: 40, padding: 0, background: C.white, color: C.accent,
                  border: `1.5px solid ${C.borderLight}`, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderLight; }}
              >
                <Eye style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, padding: '10px 0', background: h ? C.accent : C.accentPale, color: h ? C.white : C.accent, fontSize: 13, fontWeight: 700, borderRadius: 8, textAlign: 'center', transition: 'all 0.25s' }}>
                Ver detalle →
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(p.slug); }}
                aria-label={inCart ? 'Quitar de la cotización' : 'Agregar a la cotización'}
                style={{
                  width: 40, padding: 0,
                  background: inCart ? '#10b981' : C.white,
                  color: inCart ? C.white : C.accent,
                  border: `1.5px solid ${inCart ? '#10b981' : C.borderLight}`,
                  borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { if (!inCart) { e.currentTarget.style.borderColor = C.accent; } }}
                onMouseLeave={e => { if (!inCart) { e.currentTarget.style.borderColor = C.borderLight; } }}
              >
                {inCart ? <Check style={{ width: 14, height: 14 }} /> : <Plus style={{ width: 14, height: 14 }} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
