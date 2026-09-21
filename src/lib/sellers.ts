import { supabase } from './supabase';

export interface Seller {
  code: string;
  name: string;
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

  if (data?.ok) {
    const seller: Seller = { code: String(data.code), name: String(data.name) };
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
// Guarda que ese código ya se validó y cuándo — nunca el PIN. Así no lo tiene
// que tipear en cada pedido, pero si alguien le mira el celular no se lleva la
// clave. A los 30 días se vuelve a pedir.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'femavi_vendedor';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredSession {
  code: string;
  name: string;
  at: number;
}

function remember(seller: Seller): void {
  try {
    const payload: StoredSession = { code: seller.code, name: seller.name, at: Date.now() };
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
    const s = JSON.parse(raw) as StoredSession;
    if (s.code !== code) return null;
    if (Date.now() - s.at > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { code: s.code, name: s.name };
  } catch {
    return null;
  }
}

export function forgetSeller(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Si no se puede borrar, igual caduca sola a los 30 días.
  }
}
