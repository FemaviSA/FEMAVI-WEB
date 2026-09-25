import { supabase } from './supabase';
import { PROYECTO_POR_DEFECTO, esProyecto, type Proyecto } from './proyectos';

/** Lo que venga de la base o de una sesión vieja se limpia acá. */
const unProyecto = (v: unknown): Proyecto => (esProyecto(v) ? v : PROYECTO_POR_DEFECTO);

export interface Seller {
  code: string;
  name: string;
  /**
   * Pase de sesión que entrega la base al validar el PIN. Es lo que prueba que
   * el pedido lo carga este vendedor: la base saca el vendedor del pase, no de
   * lo que diga el formulario.
   */
  token: string;
  /** A qué proyecto pertenece este código: FEMAVI o FemWay. */
  proyecto: Proyecto;
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
    const seller: Seller = {
      code: String(data.code), name: String(data.name), token: String(data.token),
      proyecto: unProyecto(data.proyecto),
    };
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
  proyecto?: Proyecto;
  token: string;
}

function remember(seller: Seller): void {
  try {
    const payload: StoredSession = {
      code: seller.code, name: seller.name, token: seller.token, proyecto: seller.proyecto,
    };
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
    // Las sesiones guardadas antes de que existiera FemWay no traen proyecto:
    // se asume FEMAVI y se corrige al consultar el perfil.
    return { code: s.code, name: s.name, token: s.token, proyecto: unProyecto(s.proyecto) };
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

// ---------------------------------------------------------------------------
// Resumen de ventas del vendedor.
//
// Se pide con el pase, nunca con un código: la base saca de ahí de quién es el
// resumen, así que no hay forma de pedir el de otro vendedor.
// ---------------------------------------------------------------------------

/** Los períodos con los que miden los vendedores: por ciclo, no por mes. */
export type PeriodoVentas = 'ciclo' | 'ciclo_pasado' | 'ultimos3' | 'anio';

export interface ResumenVentas {
  /** Los ciclos que entran en el período elegido. */
  ciclos: { nombre: string; desde: string; hasta: string }[];
  totales: {
    pedidos: number; clientes: number; pesos: number;
    /** Litros y kilos juntos (1 L = 1 kg), neto de bonificaciones. */
    volumen: number;
    bonificado: number;
  };
  /** Cargados y todavía sin aprobar: no suman, solo avisan que llegaron. */
  esperando: number;
  por_estado: Record<string, number>;
  pedidos: {
    numero: string | null; fecha: string; cliente: string | null; cuenta: string | null;
    total: number | null; estado: string; motivo: string | null;
  }[];
}

export class PaseVencidoError extends Error {
  constructor() {
    super('Tu sesión venció. Volvé a ingresar tu PIN.');
    this.name = 'PaseVencidoError';
  }
}

export async function resumenDeVentas(token: string, periodo: PeriodoVentas): Promise<ResumenVentas> {
  const { data, error } = await supabase.rpc('seller_resumen', { p_token: token, p_periodo: periodo });
  if (error?.message?.includes('sesion_vencida')) throw new PaseVencidoError();
  if (error || !data) throw new Error('No se pudo cargar el resumen. Revisá la conexión.');
  return data as ResumenVentas;
}

/**
 * Vuelve a preguntar a qué proyecto pertenece el código. Hace falta para las
 * sesiones abiertas antes de que existiera FemWay, y para que un cambio se note
 * sin tener que volver a poner el PIN.
 */
export async function perfilDeVendedor(token: string): Promise<{ name: string; proyecto: Proyecto } | null> {
  const { data, error } = await supabase.rpc('seller_perfil', { p_token: token });
  if (error?.message?.includes('sesion_vencida')) throw new PaseVencidoError();
  if (error || !data) return null;
  return { name: String(data.name), proyecto: unProyecto(data.proyecto) };
}
