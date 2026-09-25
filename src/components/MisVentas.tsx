import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { resumenDeVentas, PaseVencidoError, type PeriodoVentas, type ResumenVentas } from '../lib/sellers';
import { NOMBRE_PROYECTO, type Proyecto } from '../lib/proyectos';

const ETIQUETA: Record<string, string> = {
  recibido: 'Recibido', aprobado: 'Aprobado', ingresado: 'Ingresado',
  facturado: 'Facturado', entregado: 'Entregado', rechazado: 'Rechazado',
};
const COLOR: Record<string, string> = {
  recibido: 'bg-amber-50 text-amber-700 ring-amber-200',
  aprobado: 'bg-sky-50 text-sky-700 ring-sky-200',
  ingresado: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  facturado: 'bg-violet-50 text-violet-700 ring-violet-200',
  entregado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rechazado: 'bg-red-50 text-red-700 ring-red-200',
};

/** Qué recuadro se abrió: cada uno muestra lo suyo, sin mezclar. */
type Desglose = 'volumen' | 'bonificado' | null;

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

// FEMAVI mide por ciclo: son mensuales pero el corte va variando, así que los
// carga administración. FemWay mide por mes calendario, del 1 al último día.
const PERIODOS: Record<Proyecto, [PeriodoVentas, string][]> = {
  femavi: [
    ['ciclo', 'Este ciclo'],
    ['ciclo_pasado', 'Ciclo pasado'],
    ['ultimos3', 'Últimos 3 ciclos'],
    ['anio', 'Este año'],
  ],
  femway: [
    ['ciclo', 'Este mes'],
    ['ciclo_pasado', 'Mes pasado'],
    ['ultimos3', 'Últimos 3 meses'],
    ['anio', 'Este año'],
  ],
};

export default function MisVentas({ token, proyecto, onPaseVencido }: { token: string; proyecto: Proyecto; onPaseVencido: () => void }) {
  const [periodo, setPeriodo] = useState<PeriodoVentas>('ciclo');
  const [datos, setDatos] = useState<ResumenVentas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cuál de los dos desgloses está abierto. Por ahora solo en FemWay.
  const [desglose, setDesglose] = useState<Desglose>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    resumenDeVentas(token, periodo)
      .then(r => { if (vigente) setDatos(r); })
      .catch(e => {
        if (!vigente) return;
        if (e instanceof PaseVencidoError) onPaseVencido();
        else setError(e?.message ?? 'No se pudo cargar el resumen.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, periodo, onPaseVencido]);

  const t = datos?.totales;
  const hayDesglose = proyecto === 'femway' && !!datos?.productos?.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mis ventas</h1>
          {/* Qué ciclos está mirando, con sus fechas: el nombre solo no alcanza. */}
          {datos && datos.ciclos.length > 0 && (
            <p className="text-sm text-slate-500">
              {datos.ciclos.length === 1
                ? `${datos.ciclos[0].nombre} · del ${fechaCorta(datos.ciclos[0].desde)} al ${fechaCorta(datos.ciclos[0].hasta)}`
                : `${datos.ciclos.map(c => c.nombre).join(', ')} · del ${fechaCorta(datos.ciclos[0].desde)} al ${fechaCorta(datos.ciclos[datos.ciclos.length - 1].hasta)}`}
            </p>
          )}
          {datos && datos.ciclos.length === 0 && (
            <p className="text-sm text-amber-700">Todavía no hay ciclos cargados para este período.</p>
          )}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {PERIODOS[proyecto].map(([k, r]) => (
            <button key={k} onClick={() => setPeriodo(k)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${periodo === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Un pedido cargado todavía no es una venta: cuenta cuando administración
          lo aprueba. Acá solo se avisa que llegó, para que no quede la duda. */}
      {!!datos?.esperando && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Tenés {datos.esperando} pedido{datos.esperando > 1 ? 's' : ''} esperando la aprobación de
          administración. Van a aparecer acá cuando los aprueben.
        </div>
      )}

      {cargando && !datos ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
      ) : datos && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {([
              { k: null, r: 'Facturación', v: pesos.format(t.pesos) },
              { k: 'volumen', r: 'Volumen L/kg', v: num.format(t.volumen) },
              { k: 'bonificado', r: 'Bonificado L/kg', v: num.format(t.bonificado) },
              { k: null, r: 'Pedidos · Clientes', v: `${t.pedidos} · ${t.clientes}` },
            ] as { k: Desglose; r: string; v: string }[]).map(x => {
              // Cada uno abre su propio desglose, producto por producto.
              const clickeable = !!x.k && hayDesglose;
              const abierto = clickeable && desglose === x.k;
              return (
                <button
                  key={x.r} type="button" disabled={!clickeable}
                  onClick={() => setDesglose(d => (d === x.k ? null : x.k))}
                  className={`text-left rounded-xl bg-white border px-4 py-3 ${clickeable
                    ? 'border-slate-200 hover:border-slate-300 cursor-pointer'
                    : 'border-slate-200 cursor-default'}`}
                >
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    {x.r}
                    {clickeable && (abierto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                  <div className="text-xl font-bold text-slate-900">{x.v}</div>
                </button>
              );
            })}
          </div>

          {desglose && hayDesglose && (
            <div className="mb-2 rounded-xl bg-white border border-slate-200 p-4">
              <h2 className="text-sm font-bold text-slate-700 mb-2">
                {desglose === 'volumen' ? 'Volumen por producto' : 'Bonificado por producto'}
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {datos.productos
                    .filter(p => (desglose === 'volumen' ? p.vendido : p.bonificado) > 0)
                    .map(p => (
                      <tr key={p.producto} className="border-t border-slate-100 first:border-t-0">
                        <td className="py-1.5 font-medium text-slate-800">{p.producto}</td>
                        <td className="py-1.5 text-right font-semibold text-slate-900">
                          {num.format(desglose === 'volumen' ? p.vendido : p.bonificado)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-400 mb-6">
            Ventas de {NOMBRE_PROYECTO[proyecto]}. No incluye pedidos rechazados. El volumen suma litros y kilos juntos.
          </p>

          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            {datos.pedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No cargaste pedidos en este período.</div>
            ) : (
              <ul>
                {datos.pedidos.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-t first:border-t-0 border-slate-100">
                    <span className="font-bold text-slate-900 w-16">{p.numero ?? '—'}</span>
                    <span className="text-sm text-slate-500 w-20">
                      {new Date(p.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </span>
                    <span className="flex-1 min-w-[140px] text-sm text-slate-800">
                      {p.cliente ?? '—'} {p.cuenta && <span className="text-xs text-slate-400 font-semibold ml-1">{p.cuenta}</span>}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{pesos.format(Number(p.total) || 0)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${COLOR[p.estado] ?? ''}`}>
                      {ETIQUETA[p.estado] ?? p.estado}
                    </span>
                    {p.estado === 'rechazado' && p.motivo && (
                      <span className="basis-full text-xs text-red-700">Motivo: {p.motivo}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
