const KEY = 'femavi:cart-mode';

export type CartMode = 'cotizacion' | 'pedido';

export function setCartMode(mode: CartMode) {
  sessionStorage.setItem(KEY, mode);
}

export function getCartMode(): CartMode {
  return (sessionStorage.getItem(KEY) as CartMode) ?? 'cotizacion';
}
