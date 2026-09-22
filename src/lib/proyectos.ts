// FEMAVI y FemWay son dos negocios distintos que comparten vendedores. Todo lo
// que se muestre —pedidos, resúmenes, estadísticas y el día de mañana las
// comisiones— va siempre separado por proyecto: nunca se suman.
//
// El nombre visible sale de acá: si FemWay pasa a llamarse de otra forma, se
// cambia en este archivo y listo.

export const PROYECTOS = ['femavi', 'femway'] as const;
export type Proyecto = (typeof PROYECTOS)[number];

export const PROYECTO_POR_DEFECTO: Proyecto = 'femavi';

export const NOMBRE_PROYECTO: Record<Proyecto, string> = {
  femavi: 'FEMAVI',
  femway: 'FemWay',
};

/** Colores para que se note de un vistazo con cuál está trabajando. */
export const COLOR_PROYECTO: Record<Proyecto, { chip: string; borde: string; fuerte: string }> = {
  femavi: { chip: 'bg-sky-50 text-sky-700 ring-sky-200', borde: '#0067ac', fuerte: 'bg-sky-600' },
  femway: { chip: 'bg-violet-50 text-violet-700 ring-violet-200', borde: '#7c3aed', fuerte: 'bg-violet-600' },
};

export const esProyecto = (v: unknown): v is Proyecto =>
  typeof v === 'string' && (PROYECTOS as readonly string[]).includes(v);

/** Lo que devuelve la base puede venir de una sesión vieja: se limpia acá. */
export function proyectosDe(v: unknown): Proyecto[] {
  const lista = Array.isArray(v) ? v.filter(esProyecto) : [];
  return lista.length ? lista : [PROYECTO_POR_DEFECTO];
}
