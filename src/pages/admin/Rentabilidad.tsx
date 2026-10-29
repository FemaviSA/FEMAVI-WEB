import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { fmtNum, fmtPesos } from '../../lib/adminOrders';
import {
  asignarArticulo, listaQuimwey, rentabilidad, type Rentabilidad as Datos,
} from '../../lib/rentabilidad';

// Qué tan rentable es cada vendedor de FemWay, mes a mes, como la pantalla
// "Ventas vendedor" del sistema viejo: producto por producto, precio promedio,
// venta y costo. Va por pedidos aprobados (no por lo facturado), a costo de la
// lista de Quimwey. Las devoluciones restan en el mes en que se hacen; lo sin
// cargo va aparte y no resta del margen.

const PRIMER_MES = '2026-09-01';

const diaAR = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

function meses(): string[] {
  const fin = diaAR(new Date()).slice(0, 7) + '-01';
  const out: string[] = [];
  const d = new Date(PRIMER_MES + 'T12:00:00');
  while (d.toLocaleDateString('sv-SE').slice(0, 7) + '-01' <= fin) {
    out.unshift(d.toLocaleDateString('sv-SE').slice(0, 7) + '-01');
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

const nombreMes = (iso: string) => {
  const s = new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const mesCorto = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

const pesos = (n: number | null | undefined) => (n == null ? '—' : fmtPesos.format(n));
const pct = (n: number) => fmtNum(Math.round(n * 10) / 10) + '%';

function Tarjeta({ rotulo, valor, pie, fuerte, malo }: { rotulo: string; valor: string; pie?: string; fuerte?: boolean; malo?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${fuerte ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{rotulo}</div>
      <div className={`text-xl font-bold ${fuerte ? 'text-white' : malo ? 'text-red-600' : 'text-slate-900'}`}>{valor}</div>
      {pie && <div className="text-[11px] mt-0.5 text-slate-400">{pie}</div>}
    </div>
  );
}

/** Para un producto escrito a mano que no se reconoce: elegir cuál de la lista de Quimwey es. */
function Asignar({ nombre, lista, alGuardar }: {
  nombre: string; lista: { articulo: string; producto: string; costo: number }[]; alGuardar: () => void;
}) {
  const [art, setArt] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await asignarArticulo(nombre, art);
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-64 font-semibold text-slate-900">“{nombre}”</span>
      <select value={art} onChange={e => setArt(e.target.value)}
        className="w-72 rounded-md border border-slate-300 px-2 py-1 text-sm bg-white">
        <option value="">— ¿cuál de la lista es? —</option>
        {lista.map(l => (
          <option key={l.articulo} value={l.articulo}>{l.producto} ({l.articulo}) · {fmtPesos.format(l.costo)}</option>
        ))}
      </select>
      <button onClick={guardar} disabled={!art || guardando}
        className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-semibold disabled:opacity-50">
        {guardando ? '…' : 'Guardar'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export default function Rentabilidad() {
  const opciones = meses();
  const [mes, setMes] = useState(opciones[0]);
  // '' = el equipo (sin distribuidores); 'todo'; o un código de vendedor.
  const [vendedor, setVendedor] = useState('');

  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta(v => v + 1), []);
  const [lista, setLista] = useState<{ articulo: string; producto: string; costo: number }[]>([]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    rentabilidad(mes, vendedor || null)
      .then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError((e as Error).message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [mes, vendedor, vuelta]);

  const faltaAsignar = (datos?.sin_articulo.length ?? 0) > 0;
  useEffect(() => {
    if (faltaAsignar && lista.length === 0) listaQuimwey().then(setLista).catch(() => {});
  }, [faltaAsignar, lista.length]);

  const t = datos?.totales;
  const margen = t ? t.venta - t.costo : 0;
  const equipo = datos?.vendedores.filter(v => !v.es_distribuidor) ?? [];
  const distribuidores = datos?.vendedores.filter(v => v.es_distribuidor) ?? [];

  return (
    <AdminLayout
      crumbs={[{ label: 'Rentabilidad' }]}
      actions={
        <button onClick={recargar}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      }
    >
      <p className="text-sm text-slate-500 mb-4 max-w-3xl">
        Lo que vendió cada vendedor de FemWay en el mes, por pedidos aprobados, contra lo que cuesta
        a lista de Quimwey. Las devoluciones restan en el mes en que se hacen. Lo que se entregó sin
        cargo va aparte y no resta del margen.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={vendedor} onChange={e => setVendedor(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
          <option value="">Todo el equipo</option>
          {equipo.map(v => <option key={v.code} value={v.code}>{v.code} · {v.name}{v.active ? '' : ' (inactivo)'}</option>)}
          {distribuidores.length > 0 && (
            <optgroup label="Distribuidores">
              {distribuidores.map(v => <option key={v.code} value={v.code}>{v.code} · {v.name}</option>)}
            </optgroup>
          )}
          <option value="todo">Todos (equipo + distribuidores)</option>
        </select>
        <div className="flex flex-wrap gap-1">
          {opciones.map(m => (
            <button key={m} onClick={() => setMes(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${mes === m
                ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {nombreMes(m)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {cargando && !datos ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando…
        </div>
      ) : datos && t && (
        <div className={cargando ? 'opacity-60' : ''}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <Tarjeta fuerte rotulo="Margen" valor={pesos(margen)}
              pie={t.venta > 0 ? `${pct((margen / t.venta) * 100)} de la venta` : undefined} />
            <Tarjeta rotulo="Venta" valor={pesos(t.venta)}
              pie={t.neto > 0 ? `${fmtNum(t.neto)} L/kg · prom. ${pesos(t.venta / t.neto)}` : `${fmtNum(t.neto)} L/kg`} />
            <Tarjeta rotulo="Costo Quimwey" valor={pesos(t.costo)}
              pie={t.neto > 0 ? `prom. ${pesos(t.costo / t.neto)} por L/kg` : undefined} />
            <Tarjeta rotulo="Pedidos" valor={fmtNum(t.pedidos)} pie={`compartidos: ${fmtNum(t.compartidos)}`} />
            <Tarjeta rotulo="Devoluciones" valor={t.devuelto ? `−${pesos(t.devuelto)}` : '$ 0'} malo={t.devuelto > 0}
              pie="hechas en el mes" />
          </div>

          {faltaAsignar && (
            <section className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-1">
                <AlertTriangle className="w-4 h-4" />
                {datos.sin_articulo.length === 1 ? 'Un producto sin costo' : `${datos.sin_articulo.length} productos sin costo`}
              </div>
              <p className="text-xs text-amber-700 mb-3">
                El vendedor lo escribió distinto que en la lista de Quimwey. Elegí cuál es: queda guardado
                para todos los pedidos. Mientras tanto, no suma costo y el margen da de más.
              </p>
              <div className="space-y-2">
                {datos.sin_articulo.map(n => <Asignar key={n} nombre={n} lista={lista} alGuardar={recargar} />)}
              </div>
            </section>
          )}

          <section className="rounded-xl bg-white border border-slate-200 overflow-x-auto mb-6">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2.5">Cód.</th>
                  <th className="text-left px-3 py-2.5">Producto</th>
                  <th className="text-right px-3 py-2.5">Vendió</th>
                  <th className="text-right px-3 py-2.5">Devolvió</th>
                  <th className="text-right px-3 py-2.5">Neto</th>
                  <th className="text-right px-3 py-2.5">Pcio. prom.</th>
                  <th className="text-right px-3 py-2.5">Tot. venta</th>
                  <th className="text-right px-3 py-2.5">Costo</th>
                  <th className="text-right px-3 py-2.5">Tot. costo</th>
                  <th className="text-right px-3 py-2.5">Margen</th>
                </tr>
              </thead>
              <tbody>
                {datos.productos.map((p, i) => {
                  const m = p.tot_costo == null ? null : p.venta - p.tot_costo;
                  return (
                    <tr key={(p.articulo ?? '') + p.producto + i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-400">{p.articulo ?? '—'}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{p.producto}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{p.vendio ? fmtNum(p.vendio) : '—'}</td>
                      <td className="px-3 py-2 text-right text-red-600">{p.devolvio ? `−${fmtNum(p.devolvio)}` : ''}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${p.neto < 0 ? 'text-red-600' : 'text-slate-900'}`}>{fmtNum(p.neto)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{pesos(p.precio_prom)}</td>
                      <td className={`px-3 py-2 text-right ${p.venta < 0 ? 'text-red-600' : 'text-slate-900'}`}>{pesos(p.venta)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{p.costo == null ? <span className="text-amber-600">sin costo</span> : pesos(p.costo)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{pesos(p.tot_costo)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${m != null && m < 0 ? 'text-red-600' : 'text-slate-900'}`}>{pesos(m)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                <tr>
                  <td className="px-3 py-2.5" colSpan={4}>Total</td>
                  <td className="px-3 py-2.5 text-right">{fmtNum(t.neto)}</td>
                  <td className="px-3 py-2.5 text-right">{t.neto > 0 ? pesos(t.venta / t.neto) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">{pesos(t.venta)}</td>
                  <td className="px-3 py-2.5 text-right">{t.neto > 0 ? pesos(t.costo / t.neto) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">{pesos(t.costo)}</td>
                  <td className="px-3 py-2.5 text-right">{pesos(margen)}</td>
                </tr>
              </tfoot>
            </table>
            {datos.productos.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">No hay pedidos aprobados en este mes.</div>
            )}
          </section>

          {datos.devoluciones.length > 0 && (
            <section className="rounded-xl bg-white border border-slate-200 overflow-x-auto mb-6">
              <h3 className="px-4 pt-3 text-sm font-bold text-slate-700">Devoluciones del mes</h3>
              <table className="w-full text-sm">
                <thead className="text-[11px] text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Fecha</th>
                    <th className="text-left px-4 py-2">Pedido</th>
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-left px-4 py-2">Producto</th>
                    <th className="text-right px-4 py-2">L/kg</th>
                    <th className="text-right px-4 py-2">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.devoluciones.map((d, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-600">{fechaCorta(d.fecha)}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {d.pedido}
                        {d.mes_pedido !== datos.mes && <span className="ml-1 text-[11px] text-orange-700">(pedido de {mesCorto(d.mes_pedido)})</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{d.cliente ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-900">{d.producto}</td>
                      <td className="px-4 py-2 text-right text-red-600">−{fmtNum(d.cantidad)}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-semibold">−{pesos(d.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {datos.sin_cargo.length > 0 && (
            <section className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
              <h3 className="px-4 pt-3 text-sm font-bold text-slate-700">
                Sin cargo <span className="font-normal text-slate-400">· muestras: no restan del margen</span>
              </h3>
              <table className="w-full text-sm">
                <thead className="text-[11px] text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Cód.</th>
                    <th className="text-left px-4 py-2">Producto</th>
                    <th className="text-right px-4 py-2">Cantidad</th>
                    <th className="text-right px-4 py-2">Costo</th>
                    <th className="text-right px-4 py-2">Tot. costo</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.sin_cargo.map((s, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-400">{s.articulo ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-900">{s.producto}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{fmtNum(s.cantidad)}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{pesos(s.costo)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{pesos(s.tot_costo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 font-bold">
                  <tr>
                    <td className="px-4 py-2" colSpan={2}>Total sin cargo</td>
                    <td className="px-4 py-2 text-right">{fmtNum(t.sin_cargo_cantidad)}</td>
                    <td />
                    <td className="px-4 py-2 text-right">{pesos(t.sin_cargo_costo)}</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
