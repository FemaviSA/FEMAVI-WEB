import { supabase } from './supabase';

// Clientes de FemWay. Son de dos clases: los que se pasaron desde FEMAVI —el
// mismo cliente existe en los dos lados, con el mismo código— y los que nacen
// en FemWay, que toman un número de una serie propia.

export interface ClienteFemway {
  codigo: string;
  razon_social: string;
  cuit: string | null;
  localidad: string | null;
  telefonos: string | null;
  vendedor: string | null;
  /** 'femavi' = vino del sistema viejo; 'nuevo' = nació en FemWay. */
  origen: 'femavi' | 'nuevo';
  pasado_el: string | null;
  notas: string | null;
  pedidos: number;
  ultimo_pedido: string | null;
  comprado: number;
}

export interface AltaClienteFemway {
  codigo?: string;
  razon_social: string;
  cuit?: string;
  domicilio?: string;
  localidad?: string;
  telefonos?: string;
  resp_compras?: string;
  entrega_domicilio?: string;
  entrega_localidad?: string;
  entrega_telefono?: string;
  zona?: string;
  vendedor?: string;
  notas?: string;
}

export async function clientesFemway(q?: string, vendedor?: string): Promise<ClienteFemway[]> {
  const { data, error } = await supabase.rpc('admin_femway_clientes', {
    p_q: q?.trim() || null,
    p_vendedor: vendedor || null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClienteFemway[]).map(c => ({
    ...c, pedidos: Number(c.pedidos), comprado: Number(c.comprado),
  }));
}

/** Copia un cliente del sistema viejo a FemWay. El de FEMAVI no se toca. */
export async function pasarClienteAFemway(codigo: string, vendedor: string): Promise<{ codigo: string; razon_social: string }> {
  const { data, error } = await supabase.rpc('admin_femway_pasar_cliente', {
    p_codigo: codigo, p_vendedor: vendedor,
  });
  if (error) throw new Error(error.message);
  return data as { codigo: string; razon_social: string };
}

export async function guardarClienteFemway(c: AltaClienteFemway): Promise<{ codigo: string; nuevo: boolean }> {
  const { data, error } = await supabase.rpc('admin_femway_guardar_cliente', { p: c });
  if (error) throw new Error(error.message);
  return data as { codigo: string; nuevo: boolean };
}

export async function borrarClienteFemway(codigo: string): Promise<void> {
  const { error } = await supabase.rpc('admin_femway_borrar_cliente', { p_codigo: codigo });
  if (error) throw new Error(error.message);
}
