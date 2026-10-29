import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, Undo2 } from 'lucide-react';
import { fmtNum, fmtPesos } from '../lib/adminOrders';
import {
  borrarDevolucion, devolucionesPedido, registrarDevolucion,
  type Devolucion, type RenglonDevolvible,
} from '../lib/rentabilidad';

// Lo que el cliente devolvió de un pedido aprobado. No es un rechazo: el pedido
// salió y sigue aprobado; la devolución resta en el mes en que se hace.

const hoyAR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

/** "2x10" → 10: lo que trae un bulto. */
function tamanioBulto(presentacion: string | null): number | null {
  const m = /(\d+)\s*[xX]\s*([\d.,]+)/.exec(presentacion ?? '');
  const n = m ? Number(m[2].replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fecha = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR');

export default function DevolucionesPedido({ orderId }: { orderId: number }) {
  const [renglones, setRenglones] = useState<RenglonDevolvible[]>([]);
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [dia, setDia] = useState(hoyAR());
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    devolucionesPedido(orderId)
      .then(d => { setRenglones(d.renglones); setDevoluciones(d.devoluciones); })
      .catch(e => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, [orderId]);
  useEffect(cargar, [cargar]);

  const numero = (s: string | undefined) => Number((s ?? '').replace(',', '.')) || 0;
  const elegidos = renglones
    .map(r => ({ r, q: numero(cantidades[r.idx]) }))
    .filter(x => x.q > 0);
  const totalElegido = elegidos.reduce((s, x) => s + x.q * x.r.precio_efectivo, 0);
  const pasados = elegidos.some(x => x.q > x.r.queda);
  const queda = renglones.reduce((s, r) => s + r.queda, 0);
  const devueltoTotal = devoluciones.reduce((s, d) => s + Number(d.total), 0);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await registrarDevolucion(orderId, dia, elegidos.map(x => ({ idx: x.r.idx, quantity: x.q })), nota);
      setAbierto(false);
      setCantidades({});
      setNota('');
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (d: Devolucion) => {
    if (!window.confirm(`¿Borrar la devolución del ${fecha(d.fecha)} por ${fmtPesos.format(Number(d.total))}?`)) return;
    try {
      await borrarDevolucion(d.id);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (cargando) return null;

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Undo2 className="w-4 h-4" /> Devoluciones
          {devoluciones.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${queda > 0
              ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
              {queda > 0 ? 'Devuelto parcial' : 'Devuelto total'}
            </span>
          )}
        </h3>
        {!abierto && queda > 0 && (
          <button onClick={() => setAbierto(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-300 bg-orange-50 text-orange-800 text-sm font-semibold hover:bg-orange-100">
            <Undo2 className="w-4 h-4" /> Registrar devolución
          </button>
        )}
      </div>

      {devoluciones.length === 0 && !abierto && (
        <p className="text-xs text-slate-400 mt-1">
          Si el cliente devuelve algo, cargalo acá. No se rechaza el pedido: resta en el mes de la devolución.
        </p>
      )}

      {devoluciones.map(d => (
        <div key={d.id} className="mt-3 rounded-lg bg-orange-50/60 border border-orange-200 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-orange-900">
              {fecha(d.fecha)} · −{fmtPesos.format(Number(d.total))}
            </span>
            <button onClick={() => borrar(d)} className="p-1 rounded text-slate-400 hover:text-red-600" aria-label="Borrar devolución">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="text-xs text-slate-700 mt-1">
            {d.items.map((it, i) => (
              <li key={i}>{fmtNum(Number(it.quantity))} L/kg de {it.product}{it.presentation ? ` (${it.presentation})` : ''}</li>
            ))}
          </ul>
          {d.nota && <div className="text-xs text-slate-500 mt-1">“{d.nota}”</div>}
        </div>
      ))}
      {devoluciones.length > 1 && (
        <div className="text-xs text-slate-500 mt-2 text-right">Devuelto en total: −{fmtPesos.format(devueltoTotal)}</div>
      )}

      {abierto && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">Poné cuántos L/kg volvieron de cada renglón. Lo que no volvió, dejalo vacío.</p>
          <table className="w-full text-sm">
            <thead className="text-[10px] text-slate-500 uppercase">
              <tr>
                <th className="text-left py-1">Producto</th>
                <th className="text-right py-1">Pedido</th>
                <th className="text-right py-1 w-44">Volvió (L/kg)</th>
              </tr>
            </thead>
            <tbody>
              {renglones.map(r => {
                const bulto = tamanioBulto(r.presentation);
                const q = numero(cantidades[r.idx]);
                return (
                  <tr key={r.idx} className="border-t border-slate-100">
                    <td className="py-1.5">
                      {r.product}
                      <span className="text-slate-400"> {r.presentation}</span>
                      {r.devuelto > 0 && <span className="block text-[11px] text-orange-700">ya volvieron {fmtNum(r.devuelto)}</span>}
                    </td>
                    <td className="py-1.5 text-right text-slate-500">{fmtNum(r.quantity)}</td>
                    <td className="py-1.5 text-right">
                      {r.queda > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          {bulto && bulto <= r.queda && (
                            <button type="button" title={`Suma un bulto de ${fmtNum(bulto)}`}
                              onClick={() => setCantidades(c => ({ ...c, [r.idx]: String(Math.min(r.queda, q + bulto)) }))}
                              className="px-1.5 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50">
                              +1×{fmtNum(bulto)}
                            </button>
                          )}
                          <input value={cantidades[r.idx] ?? ''} inputMode="decimal" placeholder="0"
                            onChange={e => setCantidades(c => ({ ...c, [r.idx]: e.target.value }))}
                            className={`w-20 rounded-md border px-2 py-1 text-right ${q > r.queda ? 'border-red-400' : 'border-slate-300'}`} />
                        </span>
                      ) : <span className="text-xs text-slate-400">todo devuelto</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Fecha de la devolución</span>
              <input type="date" value={dia} max={hoyAR()} onChange={e => setDia(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
            <label className="block flex-1 min-w-[180px]">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Nota (opcional)</span>
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: no le sirvió, NC 1434"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={guardar} disabled={guardando || elegidos.length === 0 || pasados || !dia}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar devolución{elegidos.length > 0 && ` · −${fmtPesos.format(totalElegido)}`}
            </button>
            <button onClick={() => { setAbierto(false); setCantidades({}); setError(null); }}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
          </div>
          {pasados && <div className="text-xs text-red-600">Hay un renglón con más de lo que queda por devolver.</div>}
        </div>
      )}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </section>
  );
}
