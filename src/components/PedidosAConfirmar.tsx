import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Printer, PhoneCall } from 'lucide-react';
import { pedidosAConfirmar, PaseVencidoError, type PedidoAConfirmar } from '../lib/sellers';
import { NOMBRE_PROYECTO, type Proyecto } from '../lib/proyectos';
import { pesos, num, fechaCorta } from './MisVentas';

/**
 * Los pedidos que el equipo cargó pero todavía hay que confirmar con el
 * cliente. Lo ve el gerente del proyecto, solo para seguirlos: no suman
 * facturación hasta que administración los aprueba, y aprobar no es de acá.
 */
export default function PedidosAConfirmar({ token, proyecto, onPaseVencido }: {
  token: string; proyecto: Proyecto; onPaseVencido: () => void;
}) {
  const [pedidos, setPedidos] = useState<PedidoAConfirmar[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Vacío = todos. Se arma con los vendedores que realmente tienen pedidos.
  const [vendedor, setVendedor] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    pedidosAConfirmar(token)
      .then(p => { if (vigente) setPedidos(p); })
      .catch(e => {
        if (!vigente) return;
        if (e instanceof PaseVencidoError) onPaseVencido();
        else setError(e?.message ?? 'No se pudieron cargar los pedidos.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [token, onPaseVencido]);

  const todos = pedidos ?? [];
  const vendedores = [...new Map(todos.map(p => [p.vendedor_code, p.vendedor])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const visibles = vendedor ? todos.filter(p => p.vendedor_code === vendedor) : todos;
  const total = visibles.reduce((s, p) => s + (Number(p.total) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 print:mb-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            A confirmar · {NOMBRE_PROYECTO[proyecto]}
          </h1>
          <p className="text-sm text-slate-500">
            Cargados por el equipo, esperando que el cliente confirme. Todavía no suman facturación.
          </p>
        </div>
        <button onClick={() => window.print()}
          className="print:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {cargando ? (
        <div className="flex items-center gap-2 p-8 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : todos.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500 text-sm">
          No hay ningún pedido esperando confirmación. Al día.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Pedidos</div>
              <div className="text-xl font-bold text-slate-900">{visibles.length}</div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Si se confirman</div>
              <div className="text-xl font-bold text-slate-900">{pesos.format(total)}</div>
            </div>
          </div>

          {vendedores.length > 1 && (
            <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1 mb-4 w-fit print:hidden">
              <button onClick={() => setVendedor('')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${vendedor === '' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                Todos
              </button>
              {vendedores.map(([code, nombre]) => (
                <button key={code} onClick={() => setVendedor(code)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${vendedor === code ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                  {nombre}
                  <span className="ml-1.5 text-xs text-slate-400">
                    {todos.filter(p => p.vendedor_code === code).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          <ul className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            {visibles.map(p => {
              const clave = p.numero ?? `${p.vendedor_code}-${p.fecha}`;
              const esta = abierto === clave;
              return (
                <li key={clave} className="border-t first:border-t-0 border-slate-100">
                  <button onClick={() => setAbierto(esta ? null : clave)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-bold text-slate-900 w-16">{p.numero ?? '—'}</span>
                    <span className="text-sm text-slate-500 w-12">{fechaCorta(p.fecha)}</span>
                    <span className="flex-1 min-w-[180px] text-sm text-slate-800">
                      {p.cliente ?? '—'}
                      {p.codigo && <span className="text-xs text-slate-400 font-semibold ml-1">{p.codigo}</span>}
                      <span className="block text-xs text-slate-400">
                        {p.vendedor}
                        {p.comparte_con ? ` · con ${p.comparte_con}` : ''}
                        {p.cuenta ? ` · ${p.cuenta}` : ''}
                      </span>
                    </span>
                    {/* Los días que lleva esperando: es lo que hay que mirar. */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.dias >= 7
                      ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                      {p.dias === 0 ? 'hoy' : p.dias === 1 ? 'hace 1 día' : `hace ${p.dias} días`}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{pesos.format(Number(p.total) || 0)}</span>
                    {esta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Al imprimir se abre todo, para que el detalle quede en el papel. */}
                  <div className={esta ? 'block' : 'hidden print:block'}>
                    <div className="px-4 pb-4 pt-1 bg-slate-50/60">
                      {p.notas && (
                        <p className="flex items-start gap-1.5 text-sm text-violet-900 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 mb-3">
                          <PhoneCall className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{p.notas}</span>
                        </p>
                      )}
                      {p.entrega && (
                        <p className="text-xs text-slate-500 mb-2">Entrega pedida: <span className="font-semibold text-slate-700">{p.entrega}</span></p>
                      )}
                      <table className="w-full text-sm">
                        <thead className="text-[11px] text-slate-400 uppercase tracking-wide">
                          <tr>
                            <th className="text-left font-semibold py-1">Producto</th>
                            <th className="text-right font-semibold py-1">L/kg</th>
                            <th className="text-left font-semibold py-1 pl-3">Envase</th>
                            <th className="text-right font-semibold py-1">Precio</th>
                            <th className="text-right font-semibold py-1">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((r, i) => (
                            <tr key={i} className="border-t border-slate-200">
                              <td className="py-1.5 text-slate-800">
                                {r.product ?? '—'}
                                {/* Un renglón negativo es una bonificación. */}
                                {(r.quantity ?? 0) < 0 && (
                                  <span className="ml-1.5 text-[10px] font-bold text-emerald-700 uppercase">bonificación</span>
                                )}
                              </td>
                              <td className="py-1.5 text-right text-slate-700">{num.format(r.quantity ?? 0)}</td>
                              <td className="py-1.5 pl-3 text-slate-500">{r.presentation || '—'}</td>
                              <td className="py-1.5 text-right text-slate-500">{r.unit_price ? pesos.format(r.unit_price) : '—'}</td>
                              <td className="py-1.5 text-right text-slate-700">{r.line_total != null ? pesos.format(r.line_total) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-slate-400 mt-3">
            Esta lista es para seguirlos. Pasarlos a aprobado lo hace administración.
          </p>
        </>
      )}
    </div>
  );
}
