import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import BarrasPorAnio from '../../components/BarrasPorAnio';
import { listarVendedores, type Vendedor, fmtNum, fmtPesos, ETIQUETA_ESTADO, type Estado } from '../../lib/adminOrders';
import { fichaCliente, etiquetaTipo, signoTipo, IVA, codigoVendedorWeb, type FichaCliente } from '../../lib/historial';

const fecha = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

function hace(iso: string | null): string {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  if (dias < 31) return `hace ${dias} días`;
  if (dias < 365) return `hace ${Math.round(dias / 30)} meses`;
  const anios = Math.floor(dias / 365);
  return `hace ${anios} año${anios > 1 ? 's' : ''}`;
}

function Tarjeta({ rotulo, valor, detalle }: { rotulo: string; valor: string; detalle?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</div>
      <div className="text-xl font-bold text-slate-900">{valor}</div>
      {detalle && <div className="text-xs text-slate-500 mt-0.5">{detalle}</div>}
    </div>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</div>
      <div className="text-sm text-slate-800">{valor || '—'}</div>
    </div>
  );
}

const PASO = 50;

export default function ClienteFicha() {
  const { codigo = '' } = useParams();
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anio, setAnio] = useState<number | 'todos'>('todos');
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [mostrar, setMostrar] = useState(PASO);

  useEffect(() => { listarVendedores().then(setVendedores).catch(() => {}); }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(null); setAnio('todos'); setMostrar(PASO); setAbiertos(new Set());
    fichaCliente(codigo)
      .then(f => { if (vigente) setFicha(f); })
      .catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [codigo]);

  const nombreVendedor = (cod: string | null) => {
    if (!cod) return '—';
    const web = codigoVendedorWeb(cod);
    const v = vendedores.find(x => x.code === web);
    return v ? `${v.name} (${web})` : `Vendedor ${cod}`;
  };

  const comprobantes = useMemo(
    () => (ficha?.comprobantes ?? []).filter(c => anio === 'todos' || (c.fecha ?? '').startsWith(String(anio))),
    [ficha, anio],
  );

  // Cada cuántos días compra, en promedio, en los últimos 3 años (solo facturas).
  const frecuencia = useMemo(() => {
    const desde = new Date(); desde.setFullYear(desde.getFullYear() - 3);
    const fechas = (ficha?.comprobantes ?? [])
      .filter(c => signoTipo(c.tipo) === 1 && c.fecha && new Date(c.fecha) >= desde)
      .map(c => new Date(c.fecha! + 'T12:00:00').getTime()).sort((a, b) => a - b);
    if (fechas.length < 3) return null;
    return Math.round((fechas[fechas.length - 1] - fechas[0]) / 86400000 / (fechas.length - 1));
  }, [ficha]);

  const alternar = (clave: string) =>
    setAbiertos(s => { const n = new Set(s); n.has(clave) ? n.delete(clave) : n.add(clave); return n; });

  if (cargando) {
    return (
      <AdminLayout crumbs={[{ label: 'Clientes', to: '/admin/clientes' }, { label: codigo }]}>
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Cargando el historial…</div>
      </AdminLayout>
    );
  }
  if (error || !ficha) {
    return (
      <AdminLayout crumbs={[{ label: 'Clientes', to: '/admin/clientes' }, { label: codigo }]}>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? `No existe el cliente ${codigo} en el sistema.`}
        </div>
      </AdminLayout>
    );
  }

  const c = ficha.cliente;
  const r = ficha.resumen;
  const v12 = Number(r?.volumen_12m ?? 0), vAnt = Number(r?.volumen_12m_anterior ?? 0);
  const variacion = vAnt > 0 ? Math.round(((v12 - vAnt) / vAnt) * 100) : null;

  return (
    <AdminLayout crumbs={[{ label: 'Clientes', to: '/admin/clientes' }, { label: c.razon_social ?? codigo }]}>
      <Link to="/admin/clientes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </Link>

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">{c.razon_social}</h1>
        <div className="text-sm text-slate-500">
          Cód. {c.codigo} · CUIT {c.cuit_formateado ?? c.cuit ?? '—'} · {nombreVendedor(c.vendedor)} · Zona {c.zona ?? '—'}
        </div>
      </div>

      {/* Números principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Tarjeta rotulo="Última compra" valor={fecha(r?.ultima_compra ?? null)} detalle={hace(r?.ultima_compra ?? null)} />
        <Tarjeta rotulo="Cliente desde" valor={fecha(r?.primera_compra ?? c.fecha_alta)} detalle={`alta ${fecha(c.fecha_alta)}`} />
        <Tarjeta rotulo="Compras" valor={fmtNum(Number(r?.compras ?? 0))}
          detalle={frecuencia ? `una cada ~${frecuencia} días (últimos 3 años)` : undefined} />
        <Tarjeta rotulo="L/kg últimos 12 meses" valor={fmtNum(v12)}
          detalle={variacion == null ? (vAnt === 0 && v12 > 0 ? 'no compró el año anterior' : undefined)
            : <span className={variacion >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                {variacion >= 0 ? '+' : ''}{variacion}% contra los 12 anteriores
              </span>} />
        <Tarjeta rotulo="L/kg histórico" valor={fmtNum(Number(r?.volumen ?? 0))} />
      </div>

      {/* Volumen por año */}
      <section className="rounded-xl bg-white border border-slate-200 p-4 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-2">Volumen por año (L/kg)</h2>
        <BarrasPorAnio etiqueta="L/kg"
          datos={ficha.por_anio.map(a => ({ anio: a.anio, valor: Number(a.volumen) }))}
          formato={n => fmtNum(Math.round(n))} />
        <details className="mt-3">
          <summary className="text-xs text-slate-500 cursor-pointer">Ver la tabla por año</summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="text-left py-1">Año</th><th className="text-right py-1">Compras</th>
                  <th className="text-right py-1">Notas de crédito</th><th className="text-right py-1">L/kg</th>
                  <th className="text-right py-1">$ (nominal)</th>
                </tr>
              </thead>
              <tbody>
                {[...ficha.por_anio].reverse().map(a => (
                  <tr key={a.anio} className="border-t border-slate-100">
                    <td className="py-1">{a.anio}</td>
                    <td className="py-1 text-right">{a.compras}</td>
                    <td className="py-1 text-right">{a.devoluciones || ''}</td>
                    <td className="py-1 text-right font-semibold">{fmtNum(Number(a.volumen))}</td>
                    <td className="py-1 text-right text-slate-500">{fmtPesos.format(Number(a.pesos))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2">
              Los pesos son nominales, del momento de cada factura: por la inflación no sirven para comparar entre años. Para eso está el volumen.
            </p>
          </div>
        </details>
      </section>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Datos del cliente */}
        <section className="rounded-xl bg-white border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Datos del cliente</h2>
          <div className="grid grid-cols-2 gap-3">
            <Dato rotulo="Domicilio" valor={[c.domicilio, c.localidad].filter(Boolean).join(', ')} />
            <Dato rotulo="Teléfonos" valor={c.telefonos} />
            <Dato rotulo="Condición IVA" valor={c.iva ? `${c.iva} ${IVA[c.iva] ?? ''}` : null} />
            <Dato rotulo="Condición de pago" valor={c.cond_pago} />
            <Dato rotulo="Entrega" valor={[c.entrega_domicilio, c.entrega_localidad].filter(Boolean).join(', ')} />
            <Dato rotulo="Expreso" valor={c.expreso && c.expreso !== '000' ? c.expreso : null} />
            <Dato rotulo="Responsable de compras" valor={c.resp_compras} />
            <Dato rotulo="Flete a cargo de" valor={c.paga_flete === '1' ? 'Cliente' : c.paga_flete === '2' ? 'FEMAVI' : null} />
            <Dato rotulo="Cód. de proveedor" valor={c.cod_proveedor} />
            <Dato rotulo="Otros" valor={c.otros} />
          </div>
        </section>

        {/* Productos */}
        <section className="rounded-xl bg-white border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Lo que más compra</h2>
          {ficha.productos.length === 0 ? <p className="text-sm text-slate-400">Sin compras netas.</p> : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-slate-500 uppercase sticky top-0 bg-white">
                  <tr><th className="text-left py-1">Producto</th><th className="text-right py-1">L/kg</th>
                    <th className="text-right py-1">Veces</th><th className="text-right py-1">Última</th></tr>
                </thead>
                <tbody>
                  {ficha.productos.map(p => (
                    <tr key={p.articulo} className="border-t border-slate-100">
                      <td className="py-1.5">{p.descripcion ?? p.articulo}<span className="text-xs text-slate-400 ml-1">{p.articulo}</span></td>
                      <td className="py-1.5 text-right font-semibold">{fmtNum(Number(p.volumen))}</td>
                      <td className="py-1.5 text-right text-slate-600">{p.veces}</td>
                      <td className="py-1.5 text-right text-slate-500 whitespace-nowrap">{fecha(p.ultima_vez)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

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

      {/* Historial de comprobantes */}
      <section className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-700">Historial de compras</h2>
          <select value={anio} onChange={e => { setAnio(e.target.value === 'todos' ? 'todos' : Number(e.target.value)); setMostrar(PASO); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
            <option value="todos">Todos los años</option>
            {[...ficha.por_anio].reverse().map(a => <option key={a.anio} value={a.anio}>{a.anio}</option>)}
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
          Las notas de crédito restan. Los comprobantes de tipo 4, 6 y 7 se muestran en gris y no suman hasta saber qué son.
        </p>
      </section>
    </AdminLayout>
  );
}
