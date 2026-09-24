import { supabase } from './supabase';
import { PaseVencidoError } from './sellers';

// Historial del sistema viejo (RM/COBOL). Lo leen los administradores (todo) y
// cada vendedor (solo sus clientes, con el token de su sesión). Las funciones
// de la base rechazan a cualquier otro.

export interface ClienteLista {
  codigo: string;
  razon_social: string | null;
  cuit: string | null;
  localidad: string | null;
  vendedor: string | null;
  zona: string | null;
  primera_compra: string | null;
  ultima_compra: string | null;
  compras: number;
  volumen: number;
  volumen_12m: number;
  volumen_12m_anterior: number;
  /** Última vez que compró el producto filtrado, si se filtró por producto. */
  ultima_vez_producto: string | null;
  /** Cada cuántos días compra, según su historia (mediana de los últimos 3 años). */
  dias_tipicos: number | null;
  dias_sin_comprar: number | null;
  /** Cuántas veces su ritmo lleva sin comprar: 2 = el doble de lo habitual. */
  atraso: number | null;
  total_filas: number;
}

export interface FiltrosClientes {
  q?: string;
  vendedor?: string;
  zona?: string;
  estado?: '' | 'activos' | 'inactivos' | 'sin_compras';
  orden?: 'ultima' | 'nombre' | 'producto' | 'atraso';
  pagina?: number;
  localidad?: string;
  /** Sin ninguna compra entre estas dos fechas (AAAA-MM-DD). */
  sinDesde?: string;
  sinHasta?: string;
  /** Código o parte de la descripción del producto. */
  producto?: string;
  prodDesde?: string;
  prodHasta?: string;
  /** Lo compraban y hace más de 12 meses que no. */
  dejoProducto?: boolean;
  /** Atrasados contra su propio ritmo de compra. */
  atrasados?: boolean;
}

/** Los parámetros de filtro que entienden las dos funciones de la base. */
const paramsDeFiltro = (f: FiltrosClientes) => ({
  p_estado: f.estado || null,
  p_orden: f.orden || 'ultima',
  p_localidad: f.localidad?.trim() || null,
  p_sin_desde: f.sinDesde || null,
  p_sin_hasta: f.sinHasta || null,
  p_producto: f.producto?.trim() || null,
  p_prod_desde: f.prodDesde || null,
  p_prod_hasta: f.prodHasta || null,
  p_dejo_producto: f.dejoProducto ?? false,
  p_atrasados: f.atrasados ?? false,
});

export const POR_PAGINA = 50;

export async function buscarClientes(f: FiltrosClientes): Promise<ClienteLista[]> {
  const { data, error } = await supabase.rpc('hist_buscar_clientes', {
    p_q: f.q?.trim() || null,
    p_vendedor: f.vendedor || null,
    p_zona: f.zona || null,
    p_limite: POR_PAGINA,
    p_offset: (f.pagina ?? 0) * POR_PAGINA,
    ...paramsDeFiltro(f),
  });
  if (error) throw new Error(error.message);
  return normalizarLista(data);
}

const normalizarLista = (data: unknown): ClienteLista[] =>
  ((data ?? []) as ClienteLista[]).map(c => ({
    ...c,
    compras: Number(c.compras), volumen: Number(c.volumen),
    volumen_12m: Number(c.volumen_12m), volumen_12m_anterior: Number(c.volumen_12m_anterior),
    total_filas: Number(c.total_filas),
  }));

function errorDeVendedor(error: { message?: string }): Error {
  return error.message?.includes('sesion_vencida') ? new PaseVencidoError() : new Error(error.message);
}

/** Clientes del vendedor dueño del token. La base pone el filtro; 50 por página. */
export async function misClientes(token: string, f: Omit<FiltrosClientes, 'vendedor' | 'zona'>): Promise<ClienteLista[]> {
  const { data, error } = await supabase.rpc('seller_clientes', {
    p_token: token,
    p_q: f.q?.trim() || null,
    p_offset: (f.pagina ?? 0) * POR_PAGINA,
    ...paramsDeFiltro(f),
  });
  if (error) throw errorDeVendedor(error);
  return normalizarLista(data);
}

/** Ficha de un cliente del vendedor; null si no existe o no es suyo. */
export async function miFichaCliente(token: string, codigo: string): Promise<FichaCliente | null> {
  const { data, error } = await supabase.rpc('seller_ficha_cliente', { p_token: token, p_codigo: codigo });
  if (error) throw errorDeVendedor(error);
  return (data as FichaCliente) ?? null;
}

export interface Renglon {
  linea: number; articulo: string | null; descripcion: string | null;
  cantidad: number | null; envase: number | null; kilos: number | null;
  precio: number | null; importe: number | null;
}

export interface Comprobante {
  clave: string; fecha: string | null; pedido: number; comprobante: number;
  tipo: string | null; total: number | null; renglones: Renglon[];
}

export interface FichaCliente {
  cliente: Record<string, string | null>;
  resumen: {
    primera_compra: string | null; ultima_compra: string | null; compras: number;
    volumen: number; volumen_12m: number; volumen_12m_anterior: number;
    pesos_12m: number; calculado_el: string;
  } | null;
  por_anio: { anio: number; compras: number; devoluciones: number; pesos: number; volumen: number }[];
  productos: { articulo: string; descripcion: string | null; volumen: number; veces: number; ultima_vez: string | null }[];
  comprobantes: Comprobante[];
  pedidos_web: { id: number; numero: string | null; fecha: string; estado: string; total: number | null; vendedor: string | null }[];
}

export async function fichaCliente(codigo: string): Promise<FichaCliente | null> {
  const { data, error } = await supabase.rpc('hist_ficha_cliente', { p_codigo: codigo });
  if (error) throw new Error(error.message);
  return (data as FichaCliente) ?? null;
}

// Tipo = último dígito del comprobante en el sistema viejo.
export const TIPO_COMPROBANTE: Record<string, string> = {
  '9': 'Factura',
  '3': 'Nota de crédito',
};
export const etiquetaTipo = (t: string | null) => (t && TIPO_COMPROBANTE[t]) || `Tipo ${t ?? '—'}`;
/** Factura suma, nota de crédito resta; los tipos sin identificar no suman. */
export const signoTipo = (t: string | null) => (t === '9' ? 1 : t === '3' ? -1 : 0);

export const IVA: Record<string, string> = { '1': 'Responsable inscripto' };

/** "010" del sistema viejo -> "10" de la web. */
export const codigoVendedorWeb = (v: string | null) => (v ? String(Number(v)) : '');

/** Cuándo pasó por última vez la PC de la oficina que sincroniza el sistema viejo. */
export async function estadoSincronizacion(): Promise<{ ultimo_uso_at: string | null; ultimo_cambio_at: string | null } | null> {
  const { data, error } = await supabase.rpc('hist_estado_sync');
  if (error) return null;
  return data as { ultimo_uso_at: string | null; ultimo_cambio_at: string | null };
}

// ── Clientes que se están cayendo ──

export type TipoCaida = 'caida' | 'perdido' | 'dormido';

export interface ClienteEnCaida {
  codigo: string;
  razon_social: string | null;
  localidad: string | null;
  vendedor: string | null;
  zona: string | null;
  telefonos: string | null;
  ultima_compra: string | null;
  compras: number;
  volumen: number;
  volumen_12m: number;
  volumen_12m_anterior: number;
  volumen_previo2: number;
  /** Litros/kg por año que se dejaron de vender. */
  perdido: number;
  caida_pct: number | null;
  tipo: TipoCaida;
  total_filas: number;
}

export interface FiltrosCaida {
  vendedor?: string;
  zona?: string;
  tipo?: TipoCaida | '';
  min?: number;
  orden?: 'perdido' | 'porcentaje' | 'ultima';
  pagina?: number;
}

export const ETIQUETA_CAIDA: Record<TipoCaida, string> = {
  caida: 'Bajó fuerte',
  perdido: 'Dejó de comprar',
  dormido: 'Dormido',
};

const normalizarCaida = (data: unknown): ClienteEnCaida[] =>
  ((data ?? []) as ClienteEnCaida[]).map(c => ({
    ...c,
    compras: Number(c.compras), volumen: Number(c.volumen), volumen_12m: Number(c.volumen_12m),
    volumen_12m_anterior: Number(c.volumen_12m_anterior), volumen_previo2: Number(c.volumen_previo2),
    perdido: Number(c.perdido), caida_pct: c.caida_pct === null ? null : Number(c.caida_pct),
    total_filas: Number(c.total_filas),
  }));

export async function clientesEnCaida(f: FiltrosCaida): Promise<ClienteEnCaida[]> {
  const { data, error } = await supabase.rpc('hist_clientes_en_caida', {
    p_vendedor: f.vendedor || null,
    p_zona: f.zona || null,
    p_tipo: f.tipo || null,
    p_min: f.min ?? null,
    p_orden: f.orden || 'perdido',
    p_limite: POR_PAGINA,
    p_offset: (f.pagina ?? 0) * POR_PAGINA,
  });
  if (error) throw new Error(error.message);
  return normalizarCaida(data);
}

/** Los del vendedor dueño del token. */
export async function misClientesEnCaida(token: string, f: Omit<FiltrosCaida, 'vendedor' | 'zona'>): Promise<ClienteEnCaida[]> {
  const { data, error } = await supabase.rpc('seller_clientes_en_caida', {
    p_token: token,
    p_tipo: f.tipo || null,
    p_min: f.min ?? null,
    p_orden: f.orden || 'perdido',
    p_limite: POR_PAGINA,
    p_offset: (f.pagina ?? 0) * POR_PAGINA,
  });
  if (error) throw errorDeVendedor(error);
  return normalizarCaida(data);
}

// ── Productos, para el buscador por producto ──

export interface ArticuloSugerido {
  codigo: string;
  descripcion: string | null;
  /** A cuántos clientes se le vendió: los más vendidos primero. */
  clientes: number;
}

const normalizarArticulos = (data: unknown): ArticuloSugerido[] =>
  ((data ?? []) as ArticuloSugerido[]).map(a => ({ ...a, clientes: Number(a.clientes) }));

export async function sugerirArticulos(q: string): Promise<ArticuloSugerido[]> {
  const { data, error } = await supabase.rpc('admin_articulos_sugeridos', { p_q: q });
  if (error) return [];
  return normalizarArticulos(data);
}

/** Los que le compran a este vendedor. */
export async function misArticulosSugeridos(token: string, q: string): Promise<ArticuloSugerido[]> {
  const { data, error } = await supabase.rpc('seller_articulos_sugeridos', { p_token: token, p_q: q });
  if (error) return [];
  return normalizarArticulos(data);
}

// ── Datos del cliente para llenar la planilla ──

/** Lo que se vuelca en el formulario; las claves son las del propio formulario. */
export interface DatosCliente {
  codigo: string;
  company: string | null;
  cuit: string | null;
  bill_address: string | null;
  bill_city: string | null;
  phone: string | null;
  client_name: string | null;
  delivery_address: string | null;
  ship_city: string | null;
  ship_phone: string | null;
  zone: string | null;
  /** Observación del sistema viejo ("BAJA 9/2011"): se muestra, no se carga. */
  nota: string | null;
}

/**
 * Datos del cliente para autocompletar el pedido. Devuelve null si el código
 * no existe, si no es cliente de ese vendedor, o si su código todavía no tiene
 * habilitado el autocompletado (hoy, solo el 10).
 */
export async function datosDeCliente(token: string, codigo: string): Promise<DatosCliente | null> {
  const { data, error } = await supabase.rpc('seller_datos_cliente', { p_token: token, p_codigo: codigo });
  if (error) throw errorDeVendedor(error);
  return (data as DatosCliente) ?? null;
}

/** Un cliente de la lista que se despliega al escribir el nombre. */
export interface ClienteSugerido {
  codigo: string;
  razon_social: string | null;
  localidad: string | null;
  cuit: string | null;
}

/**
 * Clientes del vendedor cuyo nombre (o CUIT) se parece a lo escrito. Devuelve
 * vacío si el código no tiene habilitado el autocompletado.
 */
export async function buscarMiCliente(token: string, q: string): Promise<ClienteSugerido[]> {
  const { data, error } = await supabase.rpc('seller_buscar_cliente', { p_token: token, p_q: q });
  if (error) throw errorDeVendedor(error);
  return (data ?? []) as ClienteSugerido[];
}
