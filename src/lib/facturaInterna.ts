import { supabase } from './supabase';

// Factura interna FEMAVI -> FemWay: lo que salió para FemWay en el mes, a
// costo de la lista de Quimwey. Las reglas están en la migración 0083.

export type ClaseComprobante = 'remito' | 'papelito' | 'nota_credito';

export interface RenglonInterno {
  articulo: string;
  producto: string;
  kg: number;
  costo: number | null;
  importe: number | null;
  sin_cargo: boolean;
}

export interface ComprobanteInterno {
  clase: ClaseComprobante;
  comprobante: number;
  pedido: number;
  fecha: string;
  cliente: string | null;
  vendedor: string | null;
  importe: number | null;
  renglones: RenglonInterno[];
}

export interface ProductoInterno {
  articulo: string;
  producto: string;
  costo: number | null;
  salio: number;
  volvio: number;
  sin_cargo: number;
  importe: number | null;
}

export interface FacturaInterna {
  mes: string;
  nombre: string;
  desde: string;
  hasta: string;
  ultimo_comprobante: string | null;
  totales: {
    costo: number;
    remitos: number;
    papelitos: number;
    notas_credito: number;
    sin_cargo: number;
    kg: number;
    comprobantes: number;
  };
  sin_costo: { articulo: string; producto: string; kg: number }[];
  productos: ProductoInterno[];
  comprobantes: ComprobanteInterno[];
}

/** mes: AAAA-MM-01 */
export async function facturaInterna(mes: string): Promise<FacturaInterna> {
  const { data, error } = await supabase.rpc('admin_factura_interna', { p_mes: mes });
  if (error) throw new Error(error.message);
  return data as FacturaInterna;
}

/** Los meses que tienen factura (AAAA-MM-01), el más nuevo primero. Incluye
 *  los posteriores al de hoy si ya hay un comprobante con esa fecha. */
export async function mesesFacturaInterna(): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_factura_interna_meses');
  if (error) throw new Error(error.message);
  return data as string[];
}

export async function guardarCostoQuimwey(articulo: string, costo: number | null): Promise<void> {
  const { error } = await supabase.rpc('admin_guardar_costo_quimwey', { p_articulo: articulo, p_costo: costo });
  if (error) throw new Error(error.message);
}
