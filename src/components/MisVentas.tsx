import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { resumenDeVentas, PaseVencidoError, type ResumenVentas } from '../lib/sellers';

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

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

// Fechas en hora argentina, AAAA-MM-DD.
const dia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

type Periodo = 'mes' | 'mes_pasado' | '90' | 'anio';

function rango(p: Periodo): [string, string] {
  const hoy = new Date(dia(new Date()) + 'T12:00:00');
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  if (p === 'mes') return [dia(new Date(y, m, 1, 12)), dia(hoy)];
  if (p === 'mes_pasado') return [dia(new Date(y, m - 1, 1, 12)), dia(new Date(y, m, 0, 12))];
  if (p === '90') return [dia(new Date(hoy.getTime() - 89 * 86400000)), dia(hoy)];
  return [dia(new Date(y, 0, 1, 12)), dia(hoy)];
}

export default function MisVentas({ token, onPaseVencido }: { token: string; onPaseVencido: () => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [datos, setDatos] = useState<ResumenVentas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    const [desde, hasta] = rango(periodo);
    resumenDeVentas(token, desde, hasta)
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
  const bonificado = (t?.litros_bonificados ?? 0) + (t?.kilos_bonificados ?? 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-extrabold text-slate-900">Mis ventas</h1>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([['mes', 'Este mes'], ['mes_pasado', 'Mes pasado'], ['90', '90 días'], ['anio', 'Este año']] as [Periodo, string][]).map(([k, r]) => (
            <button key={k} onClick={() => setPeriodo(k)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${periodo === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {cargando && !datos ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
      ) : datos && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {[
              { r: 'Facturación', v: pesos.format(t.pesos) },
              { r: 'Litros', v: num.format(t.litros) },
              { r: 'Kilos', v: num.format(t.kilos) + (t.unidades ? ` · ${num.format(t.unidades)} u` : '') },
              { r: 'Pedidos · Clientes', v: `${t.pedidos} · ${t.clientes}` },
            ].map(x => (
              <div key={x.r} className="rounded-xl bg-white border border-slate-200 px-4 py-3">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{x.r}</div>
                <div className="text-xl font-bold text-slate-900">{x.v}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-6">
            No incluye pedidos rechazados.{bonificado > 0 && ` Bonificaste ${num.format(bonificado)} litros/kilos en el período.`}
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
