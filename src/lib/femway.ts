import { supabase } from './supabase';
import { PaseVencidoError } from './sellers';

function errorDeVendedor(error: { message?: string }): Error {
  return error.message?.includes('sesion_vencida') ? new PaseVencidoError() : new Error(error.message);
}

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

// ── Ficha de un cliente de FemWay ──
// El ABM con sus datos y lo que compró. En FEMAVI la historia sale del sistema
// viejo; acá la historia son los pedidos de la web, que es todo lo que hay.

export interface DatosClienteFemway {
  codigo: string;
  razon_social: string;
  cuit: string | null;
  domicilio: string | null;
  localidad: string | null;
  telefonos: string | null;
  resp_compras: string | null;
  entrega_domicilio: string | null;
  entrega_localidad: string | null;
  entrega_telefono: string | null;
  zona: string | null;
  vendedor: string | null;
  origen: 'femavi' | 'nuevo';
  cliente_femavi: string | null;
  pasado_el: string | null;
  notas: string | null;
}

export interface PedidoFemway {
  id: number;
  numero: string | null;
  fecha: string;
  estado: string;
  total: number | null;
  vendedor: string | null;
  cuenta: string | null;
  items: { product: string; presentation?: string | null; quantity: number; unit_price?: number | null; line_total?: number | null }[] | null;
  /** El pedido se cargó como cliente nuevo: se le atribuye por el CUIT. */
  sin_codigo: boolean;
}

export interface FichaFemway {
  cliente: DatosClienteFemway;
  resumen: {
    pedidos: number; pesos: number; volumen: number;
    primera_compra: string | null; ultima_compra: string | null;
  } | null;
  por_anio: { anio: number; pedidos: number; pesos: number; volumen: number }[];
  productos: { producto: string; volumen: number; veces: number; pesos: number; ultima_vez: string | null }[];
  pedidos: PedidoFemway[];
}

export async function fichaClienteFemway(codigo: string): Promise<FichaFemway | null> {
  const { data, error } = await supabase.rpc('admin_femway_ficha_cliente', { p_codigo: codigo });
  if (error) throw new Error(error.message);
  return (data as FichaFemway) ?? null;
}

// ── Lo que ve el vendedor de FemWay ──
// Sus clientes y nada más: el código sale del pase de sesión, no de acá.

export interface MiClienteFemway {
  codigo: string;
  razon_social: string;
  cuit: string | null;
  localidad: string | null;
  telefonos: string | null;
  pedidos: number;
  ultima_compra: string | null;
  comprado: number;
  volumen: number;
}

export async function misClientesFemway(token: string, q?: string): Promise<MiClienteFemway[]> {
  const { data, error } = await supabase.rpc('seller_femway_clientes', {
    p_token: token, p_q: q?.trim() || null,
  });
  if (error) throw errorDeVendedor(error);
  return ((data ?? []) as MiClienteFemway[]).map(c => ({
    ...c, pedidos: Number(c.pedidos), comprado: Number(c.comprado), volumen: Number(c.volumen),
  }));
}

/** Ficha de un cliente del vendedor; null si no existe o no es suyo. */
export async function miFichaClienteFemway(token: string, codigo: string): Promise<FichaFemway | null> {
  const { data, error } = await supabase.rpc('seller_femway_ficha_cliente', {
    p_token: token, p_codigo: codigo,
  });
  if (error) throw errorDeVendedor(error);
  return (data as FichaFemway) ?? null;
}

/**
 * Si ese CUIT ya es de otro vendedor de FemWay. Un cliente es de uno solo: si
 * está ocupado, el pedido no sale. Devuelve null cuando está libre o es suyo.
 */
export async function cuitDeOtroVendedor(token: string, cuit: string): Promise<{ codigo: string; razon_social: string } | null> {
  const { data, error } = await supabase.rpc('seller_cuit_de_otro', { p_token: token, p_cuit: cuit });
  if (error) return null;   // si falla la consulta, no se traba la carga: la base frena igual
  return (data as { codigo: string; razon_social: string }) ?? null;
}

/** El vendedor deja una nota en la ficha de su cliente. Solo la nota. */
export async function guardarMiNotaFemway(token: string, codigo: string, notas: string): Promise<void> {
  const { error } = await supabase.rpc('seller_femway_guardar_nota', {
    p_token: token, p_codigo: codigo, p_notas: notas,
  });
  if (error) throw errorDeVendedor(error);
}
