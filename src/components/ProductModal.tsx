import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types/product';
import { AddToQuoteButton } from './AddToQuoteButton';
import { ProductLabel } from './ProductLabel';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentPale: 'rgba(0,103,172,0.07)', dark: '#004370',
  text: '#1a2b3c', textMuted: '#5a6f80', textLight: '#8899a8',
  borderLight: '#e2e8ee',
};

type Props = {
  product: Product | null;
  onClose: () => void;
};

export function ProductModal({ product: p, onClose }: Props) {
  useEffect(() => {
    if (!p) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [p]);

  if (!p) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,40,72,0.6)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, cursor: 'pointer',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="modal-grid"
        style={{
          background: C.white, borderRadius: 24, maxWidth: 900, width: '100%',
          maxHeight: '90vh', overflow: 'auto', cursor: 'default', position: 'relative',
          boxShadow: '0 40px 120px rgba(0,67,112,0.2)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 18, right: 18, width: 38, height: 38,
            borderRadius: 10, background: C.bg, border: 'none', color: C.textMuted,
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 10, fontFamily: 'inherit',
          }}
        >
          ✕
        </button>
        <div className="modal-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr' }}>
          <div style={{
            padding: 44, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(160deg, ${C.accentPale}, ${C.bg})`,
            borderRight: `1px solid ${C.borderLight}`,
          }}>
            <ProductLabel name={p.name} category={p.category} size={190} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 24, justifyContent: 'center' }}>
              {p.benefits.map(b => (
                <span key={b} style={{ padding: '4px 11px', background: C.accent, borderRadius: 100, fontSize: 10, color: C.white, fontWeight: 600 }}>{b}</span>
              ))}
            </div>
          </div>
          <div style={{ padding: '40px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{p.category}</span>
              {p.tags.includes('Nuevo') && (
                <span style={{ padding: '2px 8px', background: '#f59e0b', color: C.white, fontSize: 10, fontWeight: 700, borderRadius: 6, textTransform: 'uppercase' }}>
                  Nuevo
                </span>
              )}
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 800, color: C.dark, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>{p.name}</h2>
            {p.headline && (
              <p style={{ fontSize: 15, color: C.textMuted, fontStyle: 'italic', margin: '0 0 18px', lineHeight: 1.6 }}>{p.headline}</p>
            )}
            <p style={{ fontSize: 14, lineHeight: 1.8, color: C.text, margin: '0 0 20px' }}>{p.description}</p>
            {p.story && (
              <div style={{ padding: '16px 20px', background: C.accentPale, borderRadius: 12, borderLeft: `3px solid ${C.accent}`, marginBottom: 22 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                  La historia detrás del producto
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: C.textMuted, margin: 0 }}>{p.story}</p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
              {([
                ['Dilución', p.dilution ?? '—'],
                ['pH', p.ph ?? '—'],
                ['Industrias', p.industries.join(', ')],
                ['Presentaciones', p.presentations.join(', ')],
              ] as const).map(([l, v]) => (
                <div key={l} style={{ padding: '10px 14px', background: C.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 10 }}>
              <AddToQuoteButton slug={p.slug} fullWidth size="md" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <Link to="/cotizar" onClick={onClose} style={{ flex: 1, padding: '14px 0', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none', textAlign: 'center', cursor: 'pointer', display: 'block' }}>
                Cotizar ahora →
              </Link>
              <a href="https://wa.me/5491162284649" target="_blank" rel="noopener" style={{ flex: 1, padding: '14px 0', border: `2px solid ${C.accent}`, color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 10, textDecoration: 'none', textAlign: 'center', background: 'transparent', cursor: 'pointer', display: 'block' }}>
                WhatsApp ↗
              </a>
            </div>
            <Link to={`/catalogo/${p.slug}`} onClick={onClose} style={{ display: 'block', textAlign: 'center', fontSize: 13, color: C.textMuted, textDecoration: 'underline', cursor: 'pointer' }}>
              Ver ficha completa de {p.name} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
