import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useQuoteCart } from '../hooks/useQuoteCart';
import { getCartMode } from '../lib/cartMode';

const C = { accent: '#0067ac', accentDark: '#004370', white: '#FFFFFF' };

export function QuoteCartPill() {
  const { count } = useQuoteCart();
  const location = useLocation();
  const mode = getCartMode();

  const dest = mode === 'pedido' ? '/pedidos' : '/cotizar';
  const label = mode === 'pedido' ? `Confirmar pedido (${count})` : `Cotizar (${count})`;

  if (count === 0) return null;
  if (location.pathname === dest) return null;

  return (
    <Link
      to={dest}
      style={{
        position: 'fixed', bottom: 28, right: 100, zIndex: 998,
        padding: '14px 22px', background: C.accent, color: C.white,
        textDecoration: 'none', borderRadius: 100,
        boxShadow: '0 10px 30px rgba(0,103,172,0.35), 0 0 0 4px rgba(255,255,255,0.95)',
        display: 'inline-flex', alignItems: 'center', gap: 10,
        fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = C.accentDark; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = C.accent; }}
    >
      <ShoppingCart style={{ width: 18, height: 18 }} />
      <span>{label}</span>
    </Link>
  );
}
