import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

/**
 * A esta pantalla llegan los links de invitación y de "olvidé mi contraseña".
 * El link trae una sesión de un solo uso: Supabase la toma de la dirección al
 * cargar la página, y acá se usa para fijar la contraseña. Sin esta pantalla,
 * un invitado entraba una vez sin contraseña y después no podía volver.
 */
export default function NuevaClave() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (clave.length < 10) {
      setError('Usá al menos 10 caracteres.');
      return;
    }
    if (clave !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setGuardando(false);
    if (error) {
      setError(error.message.includes('different from the old')
        ? 'Tiene que ser distinta de la anterior.'
        : 'No se pudo guardar la contraseña. Pedí un link nuevo e intentá otra vez.');
      return;
    }
    navigate('/admin', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo-femavi.png" alt="FEMAVI" className="h-9 w-auto rounded" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-femavi-50 text-femavi-700 text-xs font-medium mb-4 ring-1 ring-femavi-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          Acceso restringido
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando el link…
          </div>
        ) : !session ? (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">El link venció o ya se usó</h2>
            <p className="text-slate-500 mb-6">
              Los links de invitación y de recuperación sirven una sola vez. Pedí uno nuevo desde la pantalla de ingreso.
            </p>
            <Link to="/admin/login" className="inline-block px-5 py-3 rounded-lg bg-slate-900 text-white font-semibold">
              Ir al ingreso
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Elegí tu contraseña</h2>
            <p className="text-slate-500 mb-8">
              Para <span className="font-medium text-slate-700">{session.user.email}</span>. Con esta vas a entrar al panel de ahora en más.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { rotulo: 'Nueva contraseña', valor: clave, set: setClave, foco: true },
                { rotulo: 'Repetila', valor: repetida, set: setRepetida, foco: false },
              ].map(({ rotulo, valor, set, foco }) => (
                <div key={rotulo}>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">{rotulo}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="password" required autoFocus={foco} autoComplete="new-password"
                      value={valor} onChange={e => set(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white rounded-lg border border-slate-200 focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-slate-900"
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-400">Mínimo 10 caracteres.</p>

              {error && (
                <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">{error}</div>
              )}

              <button
                type="submit" disabled={guardando}
                className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold transition flex items-center justify-center gap-2"
              >
                {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar y entrar al panel'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
