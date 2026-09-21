import { supabase } from './supabase';

export interface Seller {
  code: string;
  name: string;
  /**
   * Pase de sesión que entrega la base al validar el PIN. Es lo que prueba que
   * el pedido lo carga este vendedor: la base saca el vendedor del pase, no de
   * lo que diga el formulario.
   */
  token: string;
}

export type PinResult =
  | { ok: true; seller: Seller }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; until: string };

/**
 * El PIN nunca se compara acá: viaja a Postgres y se verifica contra el hash
 * del lado del servidor. Si lo validáramos en el navegador, cualquiera que
 * abriera el código del sitio vería los PIN de todos los vendedores.
 */
export async function verifySellerPin(code: string, pin: string): Promise<PinResult> {
  const { data, error } = await supabase.rpc('verify_seller_pin', {
    p_code: code,
    p_pin: pin,
  });

  if (error) {
    console.warn('[sellers] verify error:', error.message);
    throw new Error('No pudimos validar el PIN. Revisá la conexión e intentá de nuevo.');
  }

  if (data?.ok && data?.token) {
    const seller: Seller = { code: String(data.code), name: String(data.name), token: String(data.token) };
    remember(seller);
    return { ok: true, seller };
  }

  if (data?.reason === 'locked') {
    return { ok: false, reason: 'locked', until: String(data.until) };
  }

  return { ok: false, reason: 'invalid' };
}

// ---------------------------------------------------------------------------
// Sesión en el navegador del vendedor.
//
// Guarda el pase — nunca el PIN — para que no tenga que tipearlo en cada
// pedido. El pase vence a los 30 días del lado de la base; si administración
// da de baja al vendedor, deja de servir en el acto.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'femavi_vendedor';

interface StoredSession {
  code: string;
  name: string;
  token: string;
}

function remember(seller: Seller): void {
  try {
    const payload: StoredSession = { code: seller.code, name: seller.name, token: seller.token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Navegación privada o almacenamiento bloqueado: seguimos sin recordar,
    // el vendedor va a tener que poner el PIN cada vez pero el pedido funciona.
  }
}

export function rememberedSeller(code: string): Seller | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<StoredSession>;
    // Sesiones guardadas antes de que existiera el pase no sirven: se pide el PIN.
    if (s.code !== code || !s.token || !s.name) return null;
    return { code: s.code, name: s.name, token: s.token };
  } catch {
    return null;
  }
}

/** Cierra la sesión acá y en la base, para que el pase no sirva más. */
export function forgetSeller(token?: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Si no se puede borrar, el pase igual se invalida en la base abajo.
  }
  if (token) {
    void supabase.rpc('end_seller_session', { p_token: token }).then(({ error }) => {
      if (error) console.warn('[sellers] no se pudo cerrar la sesión:', error.message);
    });
  }
}
