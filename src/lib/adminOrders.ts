import { supabase } from './supabase';

export const ESTADOS = ['recibido', 'aprobado', 'ingresado', 'facturado', 'entregado', 'rechazado'] as const;
export type Estado = (typeof ESTADOS)[number];

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  recibido: 'Recibido',
  aprobado: 'Aprobado',
  ingresado: 'Ingresado',
  facturado: 'Facturado',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
};

/** El paso siguiente de cada estado, y cómo se llama el botón que lo da. */
export const SIGUIENTE: Partial<Record<Estado, { estado: Estado; accion: string }>> = {
  recibido: { estado: 'aprobado', accion: 'Aprobar' },
  aprobado: { estado: 'ingresado', accion: 'Marcar ingresado' },
  ingresado: { estado: 'facturado', accion: 'Marcar facturado' },
  facturado: { estado: 'entregado', accion: 'Marcar entregado' },
};

export interface ItemPedido {
  product: string;
  presentation?: string | null;
  quantity: number;
  unit_price?: number | null;
}

export interface Pedido {
  id: number;
  order_number: string | null;
  created_at: string;
  status: Estado;
  status_changed_at: string | null;
  rejection_reason: string | null;
  seller_code: string | null;
  account: string | null;
  sales_cycle: string | null;
  purchase_order: string | null;
  ship_date: string | null;
  is_new_client: boolean;
  client_code: string | null;
  company: string | null;
  client_name: string | null;
  email: string | null;
  phone: string | null;
  bill_address: string | null;
  bill_city: string | null;
  tax_condition: string | null;
  cuit: string | null;
  payment_terms: string | null;
  delivery_address: string | null;
  ship_phone: string | null;
  ship_city: string | null;
  ship_contact: string | null;
  carrier: string | null;
  zone: string | null;
  items: ItemPedido[];
  total: number | null;
  notes: string | null;
}

export interface Vendedor {
  code: string;
  name: string;
  active: boolean;
}

export interface CambioEstado {
  id: number;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  changed_at: string;
}

export async function listarPedidos(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('orders').select('*')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as Pedido[];
}

export async function listarVendedores(): Promise<Vendedor[]> {
  const { data, error } = await supabase.from('sellers').select('code, name, active');
  if (error) throw error;
  return ((data ?? []) as Vendedor[]).sort((a, b) => Number(a.code) - Number(b.code));
}

export async function historialDe(orderId: number): Promise<CambioEstado[]> {
  const { data, error } = await supabase
    .from('order_status_log').select('id, from_status, to_status, changed_by, note, changed_at')
    .eq('order_id', orderId).order('changed_at');
  if (error) throw error;
  return (data ?? []) as CambioEstado[];
}

export async function cambiarEstado(id: number, estado: Estado, motivo?: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status: estado, rejection_reason: estado === 'rechazado' ? (motivo ?? null) : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Datos que completa administración: ciclo de ventas y número del cliente nuevo. */
export async function completarDatos(id: number, datos: { sales_cycle?: string | null; client_code?: string | null }): Promise<void> {
  const { error } = await supabase.from('orders').update(datos).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Cuentas. La cantidad es el total en litros o kilos, y 1 L = 1 kg: se suma
// todo como un solo volumen, sin mirar el catálogo, así cualquier producto
// que escriban cuenta. Un renglón negativo es una bonificación y resta.
// ---------------------------------------------------------------------------

export interface Volumen { volumen: number; bonificado: number }

export function volumenDe(items: ItemPedido[]): Volumen {
  const v: Volumen = { volumen: 0, bonificado: 0 };
  for (const it of items ?? []) {
    const q = Number(it.quantity) || 0;
    v.volumen += q;
    if (q < 0) v.bonificado += -q;
  }
  return v;
}

const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
export const fmtNum = (n: number) => numero.format(n);
export const fmtPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** CSV con punto y coma: es lo que el Excel en español abre directo en columnas. */
export function exportarCsv(pedidos: Pedido[], nombreVendedor: (code: string | null) => string): void {
  const campo = (v: unknown) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const cabecera = ['Pedido', 'Fecha', 'Estado', 'Vendedor', 'Cuenta', 'N° cliente', 'Cliente nuevo', 'Razón social',
    'Ciudad', 'Zona', 'Transporte', 'Volumen L/kg', 'Bonificado L/kg', 'Total $', 'Motivo rechazo'];
  const filas = pedidos.map(p => {
    const v = volumenDe(p.items);
    return [p.order_number, fmtFecha(p.created_at), ETIQUETA_ESTADO[p.status] ?? p.status,
      nombreVendedor(p.seller_code), p.account, p.client_code, p.is_new_client ? 'sí' : '', p.company,
      p.bill_city, p.zone, p.carrier,
      String(v.volumen).replace('.', ','), String(v.bonificado).replace('.', ','), String(p.total ?? 0).replace('.', ','), p.rejection_reason];
  });
  const csv = '\uFEFF' + [cabecera, ...filas].map(f => f.map(campo).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pedidos-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}
