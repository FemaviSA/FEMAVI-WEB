import { supabase } from './supabase';

// Consulta al padrón de ARCA. La hace una función del servidor, que es la
// única que tiene el certificado; desde acá solo se pide y se muestra.

export interface PersonaArca {
  cuit: string;
  razon_social: string | null;
  tipo_persona: string | null;
  /** ACTIVO / INACTIVO según ARCA. */
  estado: string | null;
  /** Monotributo (con categoría), responsable inscripto, exento… */
  condicion: string;
  monotributo: string | null;
  impuestos: string[];
  actividades: string[];
  domicilio: string | null;
  codigo_postal: string | null;
  fecha_contrato_social: string | null;
}

/** Todavía no está cargado el certificado en el servidor. */
export class FaltaCertificadoError extends Error {
  constructor() {
    super('Falta cargar el certificado de ARCA.');
    this.name = 'FaltaCertificadoError';
  }
}

export async function consultarArca(cuit: string, orderId?: number): Promise<PersonaArca> {
  const { data, error } = await supabase.functions.invoke('arca-padron', {
    body: { cuit, order_id: orderId ?? null },
  });

  // Los errores vienen con el detalle en el cuerpo de la respuesta.
  if (error) {
    let cuerpo: { error?: string; mensaje?: string } = {};
    const respuesta = (error as { context?: Response }).context;
    if (respuesta && typeof respuesta.json === 'function') {
      try { cuerpo = await respuesta.json(); } catch { /* sin cuerpo */ }
    }
    if (cuerpo.error === 'FALTA_CERTIFICADO') throw new FaltaCertificadoError();
    throw new Error(cuerpo.error ?? error.message ?? 'No se pudo consultar ARCA.');
  }

  if (data?.error === 'FALTA_CERTIFICADO') throw new FaltaCertificadoError();
  if (!data?.ok) throw new Error(data?.error ?? 'No se pudo consultar ARCA.');
  return data.datos as PersonaArca;
}
