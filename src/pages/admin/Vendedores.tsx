import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, LogOut, Plus, X } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { NOMBRE_PROYECTO, PROYECTOS, type Proyecto } from '../../lib/proyectos';
import {
  listarVendedoresAdmin, guardarVendedor, cerrarSesionesDe, type VendedorAdmin,
} from '../../lib/adminVendedores';

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

interface Borrador {
  code: string;
  name: string;
  proyectos: Proyecto[];
  active: boolean;
  pin: string;
  esNuevo: boolean;
}

const vacio = (): Borrador => ({ code: '', name: '', proyectos: ['femavi'], active: true, pin: '', esNuevo: true });

export default function Vendedores() {
  const [filas, setFilas] = useState<VendedorAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setFilas(await listarVendedoresAdmin());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const editar = (v: VendedorAdmin) =>
    setBorrador({ code: v.code, name: v.name, proyectos: v.proyectos, active: v.active, pin: '', esNuevo: false });

  const guardar = async () => {
    if (!borrador || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await guardarVendedor(borrador);
      setAviso(
        (r.nuevo ? `Vendedor ${borrador.code} creado` : `Vendedor ${borrador.code} actualizado`) +
        (r.pin_cambiado ? ' con PIN nuevo. Pasáselo por un medio seguro: no queda guardado en ningún lado.' : '.'),
      );
      setBorrador(null);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesiones = async (v: VendedorAdmin) => {
    if (!confirm(`¿Cerrar las sesiones abiertas de ${v.name}? Va a tener que volver a poner su PIN.`)) return;
    try {
      const n = await cerrarSesionesDe(v.code);
      setAviso(n ? `Se cerraron ${n} sesión(es) de ${v.name}.` : `${v.name} no tenía sesiones abiertas.`);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const alternarProyecto = (p: Proyecto) =>
    setBorrador(b => {
      if (!b) return b;
      const tiene = b.proyectos.includes(p);
      const proyectos = tiene ? b.proyectos.filter(x => x !== p) : [...b.proyectos, p];
      return { ...b, proyectos: proyectos.length ? proyectos : b.proyectos };  // siempre al menos uno
    });

  return (
    <AdminLayout
      crumbs={[{ label: 'Vendedores' }]}
      actions={
        <button onClick={() => setBorrador(vacio())}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
          <Plus className="w-4 h-4" /> Nuevo vendedor
        </button>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        Cada vendedor entra en femavi.com.ar/vendedores/<b>su código</b> con su PIN. El PIN se guarda cifrado:
        nadie puede leerlo después, ni yo ni vos. Si un vendedor lo olvida, le ponés uno nuevo desde acá.
      </p>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {aviso && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
          <span className="flex-1">{aviso}</span>
          <button onClick={() => setAviso(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
        {cargando ? (
          <div className="flex items-center gap-2 p-8 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : (
          <table className="w-full text-sm min-w-[780px]">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Cód.</th>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Proyectos</th>
                <th className="text-left px-4 py-3">Último ingreso</th>
                <th className="text-right px-4 py-3">Pedidos</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map(v => (
                <tr key={v.code} className={`border-t border-slate-100 ${v.active ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3 font-mono text-slate-500">{v.code}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{v.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {v.proyectos.map(p => (
                        <span key={p} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${
                          p === 'femway' ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-sky-50 text-sky-700 ring-sky-200'}`}>
                          {NOMBRE_PROYECTO[p]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {fecha(v.last_login_at)}
                    {v.locked_until && new Date(v.locked_until) > new Date() && (
                      <span className="block text-xs text-red-600 font-semibold">bloqueado por intentos fallidos</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{v.pedidos}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${
                      v.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                      {v.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => editar(v)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 mr-2">
                      Editar
                    </button>
                    <button onClick={() => cerrarSesiones(v)} title="Cerrar sus sesiones abiertas"
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                      <LogOut className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Alta y edición */}
      {borrador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setBorrador(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {borrador.esNuevo ? 'Nuevo vendedor' : `Vendedor ${borrador.code}`}
              </h2>
              <button onClick={() => setBorrador(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Código
                  <input value={borrador.code} disabled={!borrador.esNuevo}
                    onChange={e => setBorrador(b => b && { ...b, code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className={campo + ' w-full mt-1 disabled:bg-slate-100'} placeholder="92" />
                </label>
                <label className="col-span-2 text-xs font-semibold text-slate-500 uppercase">
                  Nombre
                  <input value={borrador.name} onChange={e => setBorrador(b => b && { ...b, name: e.target.value })}
                    className={campo + ' w-full mt-1'} placeholder="Damián Gómez" />
                </label>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Trabaja en</div>
                <div className="flex gap-2">
                  {PROYECTOS.map(p => (
                    <button key={p} type="button" onClick={() => alternarProyecto(p)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold ring-1 ${borrador.proyectos.includes(p)
                        ? (p === 'femway' ? 'bg-violet-600 text-white ring-violet-600' : 'bg-sky-600 text-white ring-sky-600')
                        : 'bg-white text-slate-500 ring-slate-200'}`}>
                      {NOMBRE_PROYECTO[p]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-500 uppercase">
                <span className="inline-flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> PIN {borrador.esNuevo ? '' : '(dejalo vacío para no cambiarlo)'}</span>
                <input value={borrador.pin} inputMode="numeric" autoComplete="off"
                  onChange={e => setBorrador(b => b && { ...b, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  className={campo + ' w-full mt-1 tracking-widest'} placeholder="4 a 8 números" />
                <span className="block mt-1 text-[11px] font-normal normal-case text-slate-400">
                  Se guarda cifrado. Al cambiarlo, las sesiones abiertas de ese vendedor se cierran.
                </span>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={borrador.active}
                  onChange={e => setBorrador(b => b && { ...b, active: e.target.checked })} />
                Activo (si lo desactivás, no puede entrar ni cargar pedidos)
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setBorrador(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
