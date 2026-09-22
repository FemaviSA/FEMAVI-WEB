import { supabase } from './supabase';
import type { Proyecto } from './proyectos';

// Alta y administración de vendedores. El PIN viaja a la base y se guarda
// hasheado: no vuelve nunca, ni acá ni en ningún lado. Si se olvida, se pone
// uno nuevo.

export interface VendedorAdmin {
  code: string;
  name: string;
  active: boolean;
  proyectos: Proyecto[];
  last_login_at: string | null;
  locked_until: string | null;
  tiene_pin: boolean;
  pedidos: number;
  ultimo_pedido: string | null;
}

export async function listarVendedoresAdmin(): Promise<VendedorAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_vendedores');
  if (error) throw new Error(error.message);
  return ((data ?? []) as VendedorAdmin[]).map(v => ({ ...v, pedidos: Number(v.pedidos) }));
}

export interface GuardarVendedor {
  code: string;
  name: string;
  proyectos: Proyecto[];
  active: boolean;
  /** Solo si se quiere poner uno nuevo; si no, se deja como está. */
  pin?: string;
}

export async function guardarVendedor(v: GuardarVendedor): Promise<{ nuevo: boolean; pin_cambiado: boolean }> {
  const { data, error } = await supabase.rpc('admin_guardar_vendedor', {
    p_code: v.code.trim(),
    p_name: v.name.trim(),
    p_proyectos: v.proyectos,
    p_active: v.active,
    p_pin: v.pin?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as { nuevo: boolean; pin_cambiado: boolean };
}

/** Cierra las sesiones abiertas del vendedor (si perdió el celular, por ejemplo). */
export async function cerrarSesionesDe(code: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_cerrar_sesiones_vendedor', { p_code: code });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
