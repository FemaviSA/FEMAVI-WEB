import { supabase } from './supabase';

// Los ciclos de venta. Los vendedores trabajan por ciclo y no por mes
// calendario, así que los define administración a mano. El pedido guarda el
// nombre del ciclo, y sin ciclo no se puede aprobar.

export interface Ciclo {
  id: number;
  nombre: string;
  desde: string;
  hasta: string;
  /** Hoy cae adentro de este ciclo. */
  es_actual: boolean;
  /** Pedidos aprobados que le pertenecen. */
  pedidos: number;
  pesos: number;
}

export async function listarCiclos(): Promise<Ciclo[]> {
  const { data, error } = await supabase.rpc('admin_ciclos');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Ciclo[]).map(c => ({
    ...c, pedidos: Number(c.pedidos), pesos: Number(c.pesos),
  }));
}

export async function guardarCiclo(c: { id?: number; nombre: string; desde: string; hasta: string }): Promise<void> {
  const { error } = await supabase.rpc('admin_guardar_ciclo', { p: c });
  if (error) throw new Error(error.message);
}

export async function borrarCiclo(id: number): Promise<void> {
  const { error } = await supabase.rpc('admin_borrar_ciclo', { p_id: id });
  if (error) throw new Error(error.message);
}
