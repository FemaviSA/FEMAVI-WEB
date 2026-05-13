import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ShieldCheck, Package, Image as ImageIcon, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate('/admin', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : error.message);
      return;
    }
    navigate('/admin', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Branding panel — desktop */}
      <div className="hidden md:flex md:w-1/2 lg:w-2/5 relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,230,118,0.18),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(0,200,83,0.12),transparent_50%)]" />
        <div className="absolute top-12 right-12 w-72 h-72 rounded-full border border-white/5" />
        <div className="absolute top-24 right-24 w-48 h-48 rounded-full border border-white/5" />

        <div className="relative z-10 flex flex-col justify-between p-12 lg:p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-femavi-400 to-femavi-600 flex items-center justify-center font-black text-slate-950 text-lg shadow-xl shadow-femavi-500/20">
              F
            </div>
            <div>
              <div className="font-bold tracking-tight">FEMAVI</div>
              <div className="text-[10px] text-femavi-400 uppercase tracking-widest font-semibold">Admin Panel</div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight mb-4">
              Gestioná tu catálogo de
              <span className="text-femavi-400"> productos químicos</span> sin tocar código.
            </h1>
            <p className="text-slate-400 leading-relaxed text-sm lg:text-base max-w-md">
              Cargá productos, actualizá fichas técnicas y subí imágenes. Los cambios se reflejan al instante en el sitio público sin redeploy.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4">
              {[
                { icon: Package, title: 'Catálogo en vivo', desc: 'Editá los 12+ productos del catálogo desde una sola pantalla' },
                { icon: ImageIcon, title: 'Imágenes en Storage', desc: 'Subí fotos de producto que se sirven desde Supabase Storage' },
                { icon: Zap, title: 'Sin redeploy', desc: 'Los cambios aparecen en /catalogo en menos de un segundo' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-femavi-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-femavi-500/20">
                    <Icon className="w-4 h-4 text-femavi-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-600">
            FEMAVI S.A. · Ibarrola 7071, Liniers, CABA · +54 11 4644-2048
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-femavi-400 to-femavi-600 flex items-center justify-center font-black text-slate-950">
              F
            </div>
            <div>
              <div className="font-bold text-slate-900">FEMAVI</div>
              <div className="text-[10px] text-femavi-600 uppercase tracking-widest font-semibold">Admin</div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-femavi-50 text-femavi-700 text-xs font-medium mb-4 ring-1 ring-femavi-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Acceso restringido
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Iniciar sesión</h2>
          <p className="text-slate-500 mb-8">Ingresá con tu email autorizado para administrar el catálogo.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white rounded-lg border border-slate-200 focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-slate-900 placeholder:text-slate-400"
                  placeholder="admin@femavi.com.ar"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white rounded-lg border border-slate-200 focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-slate-900 placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="font-medium">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando…
                </>
              ) : (
                <>
                  Ingresar al panel
                  <span aria-hidden>→</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              ¿Olvidaste la contraseña? Reseteala desde el dashboard de Supabase →
              <br />
              <span className="text-slate-500">Auth → Users → tu email → Send recovery</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
