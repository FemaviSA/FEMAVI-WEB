import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { resumenDelEquipo, PaseVencidoError, type PeriodoVentas, type ResumenEquipo } from '../lib/sellers';
import { NOMBRE_PROYECTO, type Proyecto } from '../lib/proyectos';
import { ETIQUETA, COLOR, PERIODOS, pesos, num, fechaCorta } from './MisVentas';

type Desglose = 'volumen' | 'bonificado' | null;
type Lista = 'vendedores' | 'clientes' | 'pedidos';

const fechaDelPedido = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * Lo que ve el gerente del proyecto: el proyecto entero, vendedor por vendedor,
 * cliente por cliente y pedido por pedido. Cuenta igual que "Mis ventas": lo
 * aprobado en adelante.
 */
export default function VentasEquipo({ token, proyecto, onPaseVencido }: { token: string; proyecto: Proyecto; onPaseVencido: () => void }) {
  const [periodo, setPeriodo] = useState<PeriodoVentas>('ciclo');
  const [datos, setDatos] = useState<ResumenEquipo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desglose, setDesglose] = useState<Desglose>(null);
  const [lista, setLista] = useState<Lista>('vendedores');
  // Al tocar un vendedor, clientes y pedidos quedan filtrados por él.
  const [vendedor, setVendedor] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    resumenDelEquipo(token, periodo)
      .then(r => { if (vigente) setDatos(r); })
      .catch(e => {
        if (!vigente) return;
        if (e instanceof PaseVencidoError) onPaseVencido();
        else setError(e?.message ?? 'No se pudo cargar el resumen.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, periodo, onPaseVencido]);

  const nombre = useMemo(() => {
    const m = new Map<string, string>();
    datos?.vendedores.forEach(v => m.set(v.code, v.name));
    return (code: string) => m.get(code) ?? `Agente ${code}`;
  }, [datos]);

  const t = datos?.totales;
  const clientes = datos?.clientes.filter(c => !vendedor || c.vendedor === vendedor) ?? [];
  const pedidos = datos?.pedidos.filter(p => !vendedor || p.vendedor === vendedor) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Equipo {NOMBRE_PROYECTO[proyecto]}</h1>
          {datos && datos.ciclos.length > 0 && (
            <p className="text-sm text-slate-500">
              {datos.ciclos.length === 1
                ? `${datos.ciclos[0].nombre} · del ${fechaCorta(datos.ciclos[0].desde)} al ${fechaCorta(datos.ciclos[0].hasta)}`
                : `${datos.ciclos[0].nombre} a ${datos.ciclos[datos.ciclos.length - 1].nombre}`}
            </p>
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

      {!!datos?.esperando && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Hay {datos.esperando} pedido{datos.esperando > 1 ? 's' : ''} del equipo esperando la aprobación de
          administración. No suman hasta que los aprueben.
        </div>
      )}

      {cargando && !datos ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
      ) : datos && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {([
              { k: null, r: 'Facturación del proyecto', v: pesos.format(t.pesos) },
              { k: 'volumen', r: 'Volumen L/kg', v: num.format(t.volumen) },
              { k: 'bonificado', r: 'Bonificado L/kg', v: num.format(t.bonificado) },
              { k: null, r: 'Pedidos · Clientes', v: `${t.pedidos} · ${t.clientes}` },
            ] as { k: Desglose; r: string; v: string }[]).map(x => {
              const clickeable = !!x.k && datos.productos.length > 0;
              const abierto = clickeable && desglose === x.k;
              return (
                <button
                  key={x.r} type="button" disabled={!clickeable}
                  onClick={() => setDesglose(d => (d === x.k ? null : x.k))}
                  className={`text-left rounded-xl bg-white border border-slate-200 px-4 py-3 ${clickeable ? 'hover:border-slate-300 cursor-pointer' : 'cursor-default'}`}
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

          {desglose && datos.productos.length > 0 && (
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
            Todo {NOMBRE_PROYECTO[proyecto]}, contando lo aprobado por administración. El volumen suma litros y kilos juntos.
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {([['vendedores', 'Por vendedor'], ['clientes', 'Por cliente'], ['pedidos', 'Pedidos']] as const).map(([k, r]) => (
                <button key={k} onClick={() => setLista(k)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${lista === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                  {r}
                </button>
              ))}
            </div>
            {vendedor && lista !== 'vendedores' && (
              <button onClick={() => setVendedor(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 text-xs font-semibold">
                Solo {nombre(vendedor)} <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            {lista === 'vendedores' && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Vendedor</th>
                    <th className="text-right font-semibold px-3 py-2">Facturación</th>
                    <th className="text-right font-semibold px-3 py-2 hidden sm:table-cell">L/kg</th>
                    <th className="text-right font-semibold px-3 py-2 hidden sm:table-cell">Pedidos</th>
                    <th className="text-right font-semibold px-4 py-2 hidden sm:table-cell">Clientes</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.vendedores.map(v => (
                    <tr key={v.code}
                      onClick={() => { setVendedor(v.code); setLista('pedidos'); }}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{v.name}</div>
                        <div className="text-xs text-slate-400">
                          Agente {v.code}
                          {v.esperando > 0 && <span className="ml-2 text-amber-700 font-semibold">{v.esperando} esperando aprobación</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{pesos.format(v.pesos)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700 hidden sm:table-cell">{num.format(v.volumen)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700 hidden sm:table-cell">{v.pedidos}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700 hidden sm:table-cell">{v.clientes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {lista === 'clientes' && (clientes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No hay ventas aprobadas en este período.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Cliente</th>
                    <th className="text-left font-semibold px-3 py-2 hidden sm:table-cell">Vendedor</th>
                    <th className="text-right font-semibold px-3 py-2 hidden sm:table-cell">Pedidos</th>
                    <th className="text-right font-semibold px-4 py-2">Facturación</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {c.cliente ?? '—'} {c.codigo && <span className="text-xs text-slate-400 font-semibold ml-1">{c.codigo}</span>}
                        </div>
                        <div className="text-xs text-slate-400 sm:hidden">{nombre(c.vendedor)} · {c.pedidos} pedido{c.pedidos > 1 ? 's' : ''}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 hidden sm:table-cell">{nombre(c.vendedor)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700 hidden sm:table-cell">{c.pedidos}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">{pesos.format(Number(c.pesos) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

            {lista === 'pedidos' && (pedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No hay pedidos en este período.</div>
            ) : (
              <ul>
                {pedidos.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-t first:border-t-0 border-slate-100">
                    <span className="font-bold text-slate-900 w-16">{p.numero ?? '—'}</span>
                    <span className="text-sm text-slate-500 w-12">{fechaDelPedido(p.fecha)}</span>
                    <span className="flex-1 min-w-[160px] text-sm text-slate-800">
                      {p.cliente ?? '—'} {p.codigo && <span className="text-xs text-slate-400 font-semibold ml-1">{p.codigo}</span>}
                      <span className="block text-xs text-slate-400">{nombre(p.vendedor)}</span>
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{pesos.format(Number(p.total) || 0)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${COLOR[p.estado] ?? ''}`}>
                      {p.estado === 'recibido' ? 'Esperando aprobación' : (ETIQUETA[p.estado] ?? p.estado)}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
