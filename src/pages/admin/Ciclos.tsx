import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { fmtNum, fmtPesos } from '../../lib/adminOrders';
import { borrarCiclo, guardarCiclo, listarCiclos, type Ciclo } from '../../lib/ciclos';

// Los ciclos de venta de FEMAVI. Son mensuales pero el corte va variando, por
// eso se cargan a mano. Sin ciclo cargado no se puede aprobar ningún pedido de
// FEMAVI, así que conviene tener el siguiente dado de alta antes de que empiece.
//
// FemWay no usa esto: se mide por mes calendario, del 1 al último día, y el día
// 1 arranca en cero sin que haya que cargar nada.

const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';
const fecha = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function Ciclos() {
  const [filas, setFilas] = useState<Ciclo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<Ciclo> | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFilas(await listarCiclos());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const borrar = async (c: Ciclo) => {
    if (!confirm(`¿Borrar el ciclo ${c.nombre}?`)) return;
    try {
      await borrarCiclo(c.id);
      cargar();
    } catch (e) { setError((e as Error).message); }
  };

  const hayActual = filas.some(c => c.es_actual);

  return (
    <AdminLayout
      crumbs={[{ label: 'Ciclos' }]}
      actions={
        <button onClick={() => setEditando({ nombre: '', desde: '', hasta: '' })}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
          <Plus className="w-4 h-4" /> Nuevo ciclo
        </button>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
Son los de <b>FEMAVI</b>: mensuales, pero como el corte va variando se cargan a mano. Cada
        pedido de FEMAVI entra al ciclo que le pongas al aprobarlo, y sin ciclo no se puede aprobar.
        <b>FemWay no usa ciclos</b>: mide por mes calendario y arranca en cero el día 1.
      </p>

      {!cargando && !hayActual && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
Hoy no cae dentro de ningún ciclo cargado. Da de alta el ciclo en curso, o no vas a poder
          aprobar pedidos de FEMAVI.
        </div>
      )}

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {editando && (
        <Formulario
          ciclo={editando}
          onCerrar={() => setEditando(null)}
          onListo={() => { setEditando(null); cargar(); }}
        />
      )}

      <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
        {cargando ? (
          <div className="flex items-center gap-2 p-8 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : filas.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Todavía no hay ciclos cargados.</div>
        ) : (
          <table className="w-full text-sm min-w-[620px]">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Ciclo</th>
                <th className="text-left px-4 py-3">Desde</th>
                <th className="text-left px-4 py-3">Hasta</th>
                <th className="text-right px-4 py-3">Pedidos</th>
                <th className="text-right px-4 py-3">Vendido</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map(c => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button onClick={() => setEditando(c)} className="font-semibold text-slate-900 hover:underline">
                      {c.nombre}
                    </button>
                    {c.es_actual && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                        en curso
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fecha(c.desde)}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fecha(c.hasta)}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{fmtNum(c.pedidos)}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{fmtPesos.format(c.pesos)}</td>
                  <td className="px-2 py-3">
                    {c.pedidos === 0 && (
                      <button onClick={() => borrar(c)} title="Borrar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}

function Formulario({ ciclo, onCerrar, onListo }: {
  ciclo: Partial<Ciclo>; onCerrar: () => void; onListo: () => void;
}) {
  const [f, setF] = useState({
    nombre: ciclo.nombre ?? '', desde: ciclo.desde ?? '', hasta: ciclo.hasta ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await guardarCiclo({ id: ciclo.id, ...f });
      onListo();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">
          {ciclo.id ? `Ciclo ${ciclo.nombre}` : 'Nuevo ciclo'}
        </h3>
        <button onClick={onCerrar} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-500 uppercase">
          Nombre
          <input value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))}
            placeholder="Ciclo 9" className={campo + ' block mt-1 w-48'} />
        </label>
        <label className="text-xs font-semibold text-slate-500 uppercase">
          Desde
          <input type="date" value={f.desde} onChange={e => setF(p => ({ ...p, desde: e.target.value }))}
            className={campo + ' block mt-1'} />
        </label>
        <label className="text-xs font-semibold text-slate-500 uppercase">
          Hasta
          <input type="date" value={f.hasta} onChange={e => setF(p => ({ ...p, hasta: e.target.value }))}
            className={campo + ' block mt-1'} />
        </label>
        <button onClick={guardar} disabled={!f.nombre.trim() || !f.desde || !f.hasta || guardando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
        </button>
      </div>

      {ciclo.id && (
        <p className="mt-2 text-xs text-slate-400">
          Si le cambiás el nombre, los pedidos que ya estaban en este ciclo se actualizan solos.
        </p>
      )}
      {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  );
}
