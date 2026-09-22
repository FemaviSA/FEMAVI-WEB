import { supabase } from './supabase';

// Historial del sistema viejo (RM/COBOL). Solo lo leen administradores: las
// funciones de la base rechazan a cualquier otro.

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
  total_filas: number;
}

export interface FiltrosClientes {
  q?: string;
  vendedor?: string;
  zona?: string;
  estado?: '' | 'activos' | 'inactivos' | 'sin_compras';
  orden?: 'ultima' | 'volumen_12m' | 'volumen' | 'nombre';
  pagina?: number;
}

export const POR_PAGINA = 50;

export async function buscarClientes(f: FiltrosClientes): Promise<ClienteLista[]> {
  const { data, error } = await supabase.rpc('hist_buscar_clientes', {
    p_q: f.q?.trim() || null,
    p_vendedor: f.vendedor || null,
    p_zona: f.zona || null,
    p_estado: f.estado || null,
    p_orden: f.orden || 'ultima',
    p_limite: POR_PAGINA,
    p_offset: (f.pagina ?? 0) * POR_PAGINA,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClienteLista[]).map(c => ({
    ...c,
    compras: Number(c.compras), volumen: Number(c.volumen),
    volumen_12m: Number(c.volumen_12m), volumen_12m_anterior: Number(c.volumen_12m_anterior),
    total_filas: Number(c.total_filas),
  }));
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
