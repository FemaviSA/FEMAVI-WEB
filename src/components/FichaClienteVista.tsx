import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fmtNum, fmtPesos, ETIQUETA_ESTADO, type Estado } from '../lib/adminOrders';
import { etiquetaTipo, signoTipo, IVA, type FichaCliente } from '../lib/historial';

// Ficha de un cliente del sistema viejo: los datos del ABM y el historial de
// compras, nada más. Todo lo que sea análisis (volumen por año, caídas,
// productos) vive en las pantallas de reportes, no acá.
// La usan el admin y el vendedor: cada uno la pide a su propia función de la
// base, que decide qué puede ver.

const fecha = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

function Dato({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</div>
      <div className="text-sm text-slate-800">{valor || '—'}</div>
    </div>
  );
}

const PASO = 50;

interface Props {
  ficha: FichaCliente;
  nombreVendedor: (cod: string | null) => string;
}

/** Montarla con key={codigo} para que el estado se reinicie al cambiar de cliente. */
export default function FichaClienteVista({ ficha, nombreVendedor }: Props) {
  const [anio, setAnio] = useState<number | 'todos'>('todos');
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [mostrar, setMostrar] = useState(PASO);

  const comprobantes = useMemo(
    () => (ficha.comprobantes ?? []).filter(c => anio === 'todos' || (c.fecha ?? '').startsWith(String(anio))),
    [ficha, anio],
  );

  const anios = useMemo(
    () => [...new Set((ficha.comprobantes ?? []).map(c => (c.fecha ?? '').slice(0, 4)).filter(Boolean))].sort().reverse(),
    [ficha],
  );

  const alternar = (clave: string) =>
    setAbiertos(s => { const n = new Set(s); n.has(clave) ? n.delete(clave) : n.add(clave); return n; });

  const c = ficha.cliente;
  const r = ficha.resumen;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">{c.razon_social}</h1>
        <div className="text-sm text-slate-500">
          Cód. {c.codigo} · CUIT {c.cuit_formateado ?? c.cuit ?? '—'} · {nombreVendedor(c.vendedor)} · Zona {c.zona ?? '—'}
        </div>
      </div>

      {/* Datos del cliente, tal como están en el ABM del sistema */}
      <section className="rounded-xl bg-white border border-slate-200 p-4 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Datos del cliente</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
          <Dato rotulo="Domicilio" valor={c.domicilio} />
          {/* La provincia del sistema viejo es un código numérico: no se muestra. */}
          <Dato rotulo="Localidad" valor={c.localidad} />
          <Dato rotulo="Teléfonos" valor={c.telefonos} />
          <Dato rotulo="Responsable de compras" valor={c.resp_compras} />
          <Dato rotulo="Condición IVA" valor={c.iva ? `${c.iva} ${IVA[c.iva] ?? ''}`.trim() : null} />
          <Dato rotulo="Condición de pago" valor={c.cond_pago} />
          <Dato rotulo="Cliente desde" valor={fecha(r?.primera_compra ?? c.fecha_alta)} />
          <Dato rotulo="Última compra" valor={fecha(r?.ultima_compra ?? null)} />
          <Dato rotulo="Entrega" valor={[c.entrega_domicilio, c.entrega_localidad].filter(Boolean).join(', ')} />
          <Dato rotulo="Teléfono de entrega" valor={c.entrega_telefono} />
          <Dato rotulo="Expreso" valor={c.expreso && c.expreso !== '000' ? c.expreso : null} />
          <Dato rotulo="Flete a cargo de" valor={c.paga_flete === '1' ? 'Cliente' : c.paga_flete === '2' ? 'FEMAVI' : null} />
          <Dato rotulo="Cód. de proveedor" valor={c.cod_proveedor} />
          <Dato rotulo="Otros" valor={c.otros} />
        </div>
      </section>

      {/* Pedidos cargados por la web */}
      {ficha.pedidos_web.length > 0 && (
        <section className="rounded-xl bg-white border border-slate-200 p-4 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Pedidos por la web</h2>
          <table className="w-full text-sm">
            <tbody>
              {ficha.pedidos_web.map(p => (
                <tr key={p.id} className="border-t border-slate-100 first:border-t-0">
                  <td className="py-1.5 font-semibold">{p.numero}</td>
                  <td className="py-1.5 text-slate-500">{fecha(p.fecha)}</td>
                  <td className="py-1.5 text-slate-600">{p.vendedor ? nombreVendedor(p.vendedor.padStart(3, '0')) : 'Web'}</td>
                  <td className="py-1.5">{ETIQUETA_ESTADO[p.estado as Estado] ?? p.estado}</td>
                  <td className="py-1.5 text-right font-semibold">{fmtPesos.format(Number(p.total) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Historial de compras */}
      <section className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-700">Historial de compras</h2>
          <select value={anio} onChange={e => { setAnio(e.target.value === 'todos' ? 'todos' : Number(e.target.value)); setMostrar(PASO); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
            <option value="todos">Todos los años</option>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {comprobantes.length === 0 ? <p className="text-sm text-slate-400">Sin comprobantes.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="w-6" /><th className="text-left py-2">Fecha</th><th className="text-left py-2">Pedido</th>
                  <th className="text-left py-2">Comprobante</th><th className="text-right py-2">L/kg</th><th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {comprobantes.slice(0, mostrar).map(cp => {
                  const signo = signoTipo(cp.tipo);
                  const kilos = cp.renglones.reduce((s, x) => s + (Number(x.kilos) || 0), 0);
                  const abierto = abiertos.has(cp.clave);
                  const tono = signo === -1 ? 'text-red-700' : signo === 0 ? 'text-slate-400' : 'text-slate-900';
                  return (
                    <Fragment key={cp.clave}>
                      <tr onClick={() => alternar(cp.clave)} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                        <td className="py-2 text-slate-400">{abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                        <td className="py-2 whitespace-nowrap">{fecha(cp.fecha)}</td>
                        <td className="py-2">{cp.pedido}</td>
                        <td className="py-2">
                          <span className={signo === -1 ? 'text-red-700 font-semibold' : signo === 0 ? 'text-slate-400' : ''}>{etiquetaTipo(cp.tipo)}</span>
                          <span className="text-xs text-slate-400 ml-1">{cp.comprobante}</span>
                        </td>
                        <td className={`py-2 text-right font-semibold ${tono}`}>{signo === -1 ? '−' : ''}{fmtNum(kilos)}</td>
                        <td className={`py-2 text-right ${tono}`}>{signo === -1 ? '−' : ''}{fmtPesos.format(Number(cp.total) || 0)}</td>
                      </tr>
                      {abierto && (
                        <tr className="bg-slate-50">
                          <td />
                          <td colSpan={5} className="py-2">
                            <table className="w-full text-xs">
                              <thead className="text-slate-400 uppercase">
                                <tr><th className="text-left py-1">Producto</th><th className="text-right">Cant.</th><th className="text-right">Env.</th>
                                  <th className="text-right">L/kg</th><th className="text-right">Precio</th><th className="text-right">Importe</th></tr>
                              </thead>
                              <tbody>
                                {cp.renglones.map(x => (
                                  <tr key={x.linea} className="border-t border-slate-200">
                                    <td className="py-1">{x.descripcion ?? '—'} <span className="text-slate-400">{x.articulo}</span></td>
                                    <td className="text-right">{x.cantidad}</td><td className="text-right">{x.envase}</td>
                                    <td className="text-right">{fmtNum(Number(x.kilos) || 0)}</td>
                                    <td className="text-right">{fmtPesos.format(Number(x.precio) || 0)}</td>
                                    <td className="text-right">{fmtPesos.format(Number(x.importe) || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {comprobantes.length > mostrar && (
          <button onClick={() => setMostrar(m => m + PASO)}
            className="mt-3 w-full py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Ver {Math.min(PASO, comprobantes.length - mostrar)} más (quedan {comprobantes.length - mostrar})
          </button>
        )}
        <p className="text-xs text-slate-400 mt-3">
          Las notas de crédito restan. Los comprobantes de tipo 4, 6 y 7 se muestran en gris y no suman.
        </p>
      </section>
    </>
  );
}
