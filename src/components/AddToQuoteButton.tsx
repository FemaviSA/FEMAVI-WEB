import { useQuoteCart } from '../hooks/useQuoteCart';
import { Check, Plus } from 'lucide-react';

const C = {
  accent: '#0067ac',
  white: '#FFFFFF',
  borderLight: '#e2e8ee',
  text: '#1a2b3c',
  success: '#10b981',
  successPale: 'rgba(16,185,129,0.1)',
  successBorder: 'rgba(16,185,129,0.3)',
};

export function AddToQuoteButton({
  slug,
  size = 'md',
  variant = 'outline',
  fullWidth = false,
}: {
  slug: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'solid' | 'ghost';
  fullWidth?: boolean;
}) {
  const { has, toggle } = useQuoteCart();
  const inCart = has(slug);

  const padding = size === 'sm' ? '8px 14px' : size === 'lg' ? '16px 28px' : '12px 20px';
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 15 : 13;

  const styles: React.CSSProperties = {
    padding,
    fontSize,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: fullWidth ? '100%' : undefined,
    border: '1.5px solid',
    background: inCart ? C.successPale : (variant === 'solid' ? C.accent : C.white),
    color: inCart ? C.success : (variant === 'solid' ? C.white : C.accent),
    borderColor: inCart ? C.successBorder : (variant === 'solid' ? C.accent : C.borderLight),
  };

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(slug); }}
      style={styles}
      aria-pressed={inCart}
    >
      {inCart ? (
        <>
          <Check style={{ width: 14, height: 14 }} />
          <span>Agregado a cotización</span>
        </>
      ) : (
        <>
          <Plus style={{ width: 14, height: 14 }} />
          <span>Agregar a cotización</span>
        </>
      )}
    </button>
  );
}
