import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { esProyecto, type Proyecto } from '../lib/proyectos';
import { useAuth } from './useAuth';

// Un admin puede ver un solo proyecto (admin_emails.proyecto): la secretaria
// de ventas de FemWay ve solo FemWay, para que no se confunda con FEMAVI.
// null = ve todo. No es seguridad: el panel se arma según esto.

let cache: { email: string; pedido: Promise<Proyecto | null> } | null = null;

function proyectoDe(email: string): Promise<Proyecto | null> {
  if (cache?.email !== email) {
    cache = {
      email,
      pedido: Promise.resolve(supabase.rpc('admin_proyecto'))
        .then(({ data }) => (esProyecto(data) ? data : null))
        .catch(() => null),
    };
  }
  return cache.pedido;
}

/** El proyecto al que está limitado el admin, o null si ve todo. */
export function useProyectoAdmin(): { cargando: boolean; proyecto: Proyecto | null } {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const [estado, setEstado] = useState<{ email: string; proyecto: Proyecto | null } | null>(null);

  useEffect(() => {
    if (!email) return;
    let vigente = true;
    proyectoDe(email).then(p => { if (vigente) setEstado({ email, proyecto: p }); });
    return () => { vigente = false; };
  }, [email]);

  const listo = !!email && estado?.email === email;
  return { cargando: !listo, proyecto: listo ? estado!.proyecto : null };
}
