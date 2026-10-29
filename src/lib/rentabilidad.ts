import { supabase } from './supabase';

// Devoluciones de pedidos aprobados y rentabilidad por vendedor de FemWay.
// Las reglas están en la migración 0090: la devolución resta en el mes en que se
// hace, la rentabilidad va por pedidos aprobados a costo de Quimwey y lo sin
// cargo se muestra aparte, sin restar del margen.

export interface RenglonDevolvible {
  idx: number;
  product: string;
  presentation: string | null;
  quantity: number;
  unit_price: number;
  /** Lo que se cobró por L/kg, con la bonificación repartida. */
  precio_efectivo: number;
  devuelto: number;
  queda: number;
}

export interface Devolucion {
  id: number;
  fecha: string;
  items: { idx: number; product: string; presentation: string | null; quantity: number; unit_price: number; line_total: number }[];
  total: number;
  nota: string | null;
  created_by: string | null;
  created_at: string;
}

export async function devolucionesPedido(orderId: number): Promise<{ renglones: RenglonDevolvible[]; devoluciones: Devolucion[] }> {
  const { data, error } = await supabase.rpc('admin_devoluciones_pedido', { p_order_id: orderId });
  if (error) throw new Error(error.message);
  return data;
}

export async function registrarDevolucion(
  orderId: number, fecha: string, items: { idx: number; quantity: number }[], nota: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_registrar_devolucion', {
    p_order_id: orderId, p_fecha: fecha, p_items: items, p_nota: nota,
  });
  if (error) throw new Error(error.message);
}

export async function borrarDevolucion(id: number): Promise<void> {
  const { error } = await supabase.rpc('admin_borrar_devolucion', { p_id: id });
  if (error) throw new Error(error.message);
}

export interface FilaRentabilidad {
  articulo: string | null;
  producto: string;
  vendio: number;
  devolvio: number;
  neto: number;
  venta: number;
  precio_prom: number | null;
  costo: number | null;
  tot_costo: number | null;
}

export interface Rentabilidad {
  mes: string;
  vendedor: string | null;
  vendedores: { code: string; name: string; es_distribuidor: boolean; active: boolean }[];
  productos: FilaRentabilidad[];
  sin_cargo: { articulo: string | null; producto: string; cantidad: number; costo: number | null; tot_costo: number | null }[];
  devoluciones: { fecha: string; pedido: string; cliente: string | null; mes_pedido: string; producto: string; cantidad: number; importe: number }[];
  /** Productos que no se sabe qué artículo de Quimwey son: no tienen costo. */
  sin_articulo: string[];
  totales: {
    neto: number;
    venta: number;
    costo: number;
    sin_costo: number;
    devuelto: number;
    sin_cargo_cantidad: number;
    sin_cargo_costo: number;
    pedidos: number;
    compartidos: number;
  };
}

/** vendedor: null = el equipo (sin distribuidores); 'todo'; o un código. */
export async function rentabilidad(mes: string, vendedor: string | null): Promise<Rentabilidad> {
  const { data, error } = await supabase.rpc('admin_rentabilidad', { p_mes: mes, p_vendedor: vendedor });
  if (error) throw new Error(error.message);
  return data as Rentabilidad;
}

export async function listaQuimwey(): Promise<{ articulo: string; producto: string; costo: number }[]> {
  const { data, error } = await supabase.rpc('admin_lista_quimwey');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function asignarArticulo(nombre: string, articulo: string): Promise<void> {
  const { error } = await supabase.rpc('admin_asignar_articulo', { p_nombre: nombre, p_articulo: articulo });
  if (error) throw new Error(error.message);
}
