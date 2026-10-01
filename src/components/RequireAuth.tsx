import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProyectoAdmin } from '../hooks/useProyectoAdmin';
import { supabase } from '../lib/supabase';

/**
 * Tener usuario no alcanza: hay que estar en la lista de administradores
 * (admin_emails). La base ya no le muestra datos a nadie más, pero sin este
 * control cualquiera que se registrara entraba igual a las pantallas del admin.
 */
export function RequireAuth({ children, todoElPanel = false }: {
  children: React.ReactNode;
  /**
   * Pantallas que no son de un proyecto (productos, cotizaciones, blog) o que
   * son de FEMAVI. El admin limitado a un proyecto va directo a Pedidos.
   */
  todoElPanel?: boolean;
}) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const { cargando: cargandoProyecto, proyecto } = useProyectoAdmin();

  useEffect(() => {
    // Al rechazar a alguien se le cierra la sesión: el cartel de "sin acceso"
    // tiene que quedar, en vez de mandarlo al login sin explicación.
    if (!session) { setEsAdmin(prev => (prev === false ? false : null)); return; }
    let vigente = true;
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!vigente) return;
      const ok = !error && data === true;
      setEsAdmin(ok);
      if (!ok) void supabase.auth.signOut();
    });
    return () => { vigente = false; };
  }, [session]);

  if (loading || (session && esAdmin === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Cargando…</div>
      </div>
    );
  }

  if (esAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-slate-800 font-semibold mb-2">Esta cuenta no tiene acceso al panel.</p>
          <p className="text-slate-500 text-sm">Si necesitás entrar, pedíselo a administración.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (todoElPanel) {
    if (cargandoProyecto) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 text-sm">Cargando…</div>
        </div>
      );
    }
    if (proyecto) return <Navigate to="/admin/pedidos" replace />;
  }

  return <>{children}</>;
}
