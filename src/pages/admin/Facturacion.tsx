import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { useProyectoAdmin } from '../../hooks/useProyectoAdmin';
import { NOMBRE_PROYECTO, PROYECTOS, type Proyecto } from '../../lib/proyectos';
import {
  facturacion, listarVendedores, fmtNum, fmtPesos,
  type CanalVentas, type Facturacion as Datos, type Vendedor,
} from '../../lib/adminOrders';

// La facturación en un solo lugar: el período que se quiera, los vendedores
// que se quieran, y el número abierto mes a mes. Antes esto se leía en la
// lista de pedidos, con la pestaña en Aprobado y sumando a ojo.
//
// Factura lo aprobado y nada más. Lo que está esperando se muestra aparte, en
// gris: es plata que todavía no entró.

// Día en hora argentina (AAAA-MM-DD): con toISOString un pedido de las 22 hs
// caería en el día siguiente.
const diaAR = (d: Date) =>
  d.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

type Periodo = 'mes' | 'mes_pasado' | 'ultimos3' | 'anio' | 'doce' | 'personalizado';

const PERIODOS: [Periodo, string][] = [
  ['mes', 'Este mes'],
  ['mes_pasado', 'Mes pasado'],
  ['ultimos3', 'Últimos 3 meses'],
  ['anio', 'Este año'],
  ['doce', 'Últimos 12 meses'],
  ['personalizado', 'Elegir fechas'],
];

/** Desde y hasta de cada período, en hora argentina. */
function rango(p: Periodo): { desde: string; hasta: string } {
  const hoy = new Date(diaAR(new Date()) + 'T12:00:00');
  const a = hoy.getFullYear(), m = hoy.getMonth();
  const dia = (d: Date) => d.toLocaleDateString('sv-SE');
  const finDeMes = (anio: number, mes: number) => new Date(anio, mes + 1, 0);
  switch (p) {
    case 'mes_pasado':
      return { desde: dia(new Date(a, m - 1, 1)), hasta: dia(finDeMes(a, m - 1)) };
    case 'ultimos3':
      return { desde: dia(new Date(a, m - 2, 1)), hasta: dia(finDeMes(a, m)) };
    case 'anio':
      return { desde: dia(new Date(a, 0, 1)), hasta: dia(finDeMes(a, 11)) };
    case 'doce':
      return { desde: dia(new Date(a, m - 11, 1)), hasta: dia(finDeMes(a, m)) };
    default:
      return { desde: dia(new Date(a, m, 1)), hasta: dia(finDeMes(a, m)) };
  }
}

const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

function Tarjeta({ rotulo, valor, pie }: { rotulo: string; valor: string; pie?: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</div>
      <div className="text-xl font-bold text-slate-900">{valor}</div>
      {pie && <div className="text-[11px] text-slate-400 mt-0.5">{pie}</div>}
    </div>
  );
}

type Lista = 'vendedores' | 'productos' | 'clientes';

export default function Facturacion() {
  const { cargando: cargandoProyecto, proyecto: proyectoFijo } = useProyectoAdmin();
  const [proyectoElegido, setProyecto] = useState<Proyecto>('femavi');
  const proyecto = proyectoFijo ?? proyectoElegido;

  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [desde, setDesde] = useState(rango('mes').desde);
  const [hasta, setHasta] = useState(rango('mes').hasta);
  const [canal, setCanal] = useState<CanalVentas>('vendedores');
  // Vacío = todos. Si se eligen dos, se suman los dos.
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [lista, setLista] = useState<Lista>('vendedores');

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listarVendedores().then(setVendedores).catch(() => {}); }, []);

  const elegirPeriodo = (p: Periodo) => {
    setPeriodo(p);
    if (p === 'personalizado') return;
    const r = rango(p);
    setDesde(r.desde);
    setHasta(r.hasta);
  };

  useEffect(() => {
    if (cargandoProyecto) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    facturacion(proyecto, desde, hasta, elegidos, canal)
      .then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError((e as Error).message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cargandoProyecto, proyecto, desde, hasta, elegidos, canal]);

  const delProyecto = useMemo(
    () => vendedores.filter(v => v.proyecto === proyecto
      && (canal === 'todo' || !!v.es_distribuidor === (canal === 'distribucion'))),
    [vendedores, proyecto, canal],
  );
  const hayDistribuidores = useMemo(
    () => vendedores.some(v => v.es_distribuidor && v.proyecto === proyecto),
    [vendedores, proyecto],
  );

  const alternar = (code: string) =>
    setElegidos(p => p.includes(code) ? p.filter(c => c !== code) : [...p, code]);

  const t = datos?.totales;
  const maxMes = Math.max(1, ...(datos?.meses ?? []).map(m => Number(m.pesos) || 0));
  const nombreVendedor = (code: string | null) => {
    if (!code) return 'Web';
    const v = vendedores.find(x => x.code === code);
    return v ? v.name : `Agente ${code}`;
  };

  return (
    <AdminLayout
      crumbs={[{ label: 'Facturación' }]}
      actions={
        <button onClick={() => { setCargando(true); setElegidos(e => [...e]); }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      }
    >
      {/* Proyecto: el corte principal, igual que en pedidos. */}
      {!proyectoFijo && (
        <div className="flex gap-2 mb-3">
          {PROYECTOS.map(k => (
            <button key={k} onClick={() => { setProyecto(k); setElegidos([]); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ring-1 ${proyecto === k
                ? (k === 'femway' ? 'bg-violet-600 text-white ring-violet-600' : 'bg-sky-600 text-white ring-sky-600')
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
              {NOMBRE_PROYECTO[k]}
            </button>
          ))}
        </div>
      )}

      {/* Vendedores o distribución: son dos negocios y no se mezclan. */}
      {hayDistribuidores && (
        <div className="inline-flex gap-1 p-1 mb-3 rounded-lg bg-slate-100">
          {([['vendedores', 'Vendedores'], ['distribucion', 'Distribución'], ['todo', 'Todo junto']] as [CanalVentas, string][]).map(([k, r]) => (
            <button key={k} onClick={() => { setCanal(k); setElegidos([]); }}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${canal === k
                ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Período */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {PERIODOS.map(([k, r]) => (
          <button key={k} onClick={() => elegirPeriodo(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${periodo === k
              ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {r}
          </button>
        ))}
        {periodo === 'personalizado' && (
          <>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={campo} />
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={campo} />
          </>
        )}
        <span className="text-xs text-slate-400">
          {fechaCorta(desde)} al {fechaCorta(hasta)}
        </span>
      </div>

      {/* Vendedores: ninguno elegido = todos; se pueden marcar varios. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button onClick={() => setElegidos([])}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition ${elegidos.length === 0
            ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
          Todos
        </button>
        {delProyecto.map(v => (
          <button key={v.code} onClick={() => alternar(v.code)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition ${elegidos.includes(v.code)
              ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
            {v.name}
            {!v.active && <span className="opacity-60"> · baja</span>}
          </button>
        ))}
        {elegidos.length > 1 && (
          <span className="text-xs text-slate-400">Se suman los {elegidos.length} elegidos.</span>
        )}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {cargando && !datos ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando…
        </div>
      ) : datos && t && (
        <div className={cargando ? 'opacity-60' : ''}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Tarjeta rotulo="Facturación" valor={fmtPesos.format(t.pesos)} pie="solo pedidos aprobados" />
            <Tarjeta rotulo="Pedidos" valor={fmtNum(t.pedidos)} pie={`${fmtNum(t.clientes)} clientes`} />
            <Tarjeta rotulo="Volumen L/kg" valor={fmtNum(t.volumen)} />
            <Tarjeta rotulo="Bonificado L/kg" valor={fmtNum(t.bonificado)} />
          </div>

          {datos.esperando.pedidos > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-6 text-sm text-slate-600">
              Además hay <b>{fmtNum(datos.esperando.pedidos)}</b> {datos.esperando.pedidos === 1 ? 'pedido' : 'pedidos'} sin
              aprobar por <b>{fmtPesos.format(datos.esperando.pesos)}</b>
              {datos.esperando.a_confirmar > 0 && <> ({fmtNum(datos.esperando.a_confirmar)} a confirmar con el cliente)</>}.
              Todavía no es facturación.
            </div>
          )}

          {/* Mes a mes */}
          {datos.meses.length > 0 && (
            <section className="rounded-xl bg-white border border-slate-200 p-4 mb-6">
              <h2 className="text-sm font-bold text-slate-700 mb-3">Mes a mes</h2>
              <div className="space-y-2">
                {datos.meses.map(m => (
                  <div key={m.mes} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-xs text-slate-500">{m.nombre}</div>
                    <div className="flex-1 h-6 rounded bg-slate-50 overflow-hidden">
                      <div className="h-full rounded bg-sky-500/80"
                        style={{ width: `${Math.max(2, (Number(m.pesos) / maxMes) * 100)}%` }} />
                    </div>
                    <div className="w-36 shrink-0 text-right text-sm font-semibold text-slate-900">
                      {fmtPesos.format(m.pesos)}
                    </div>
                    <div className="w-20 shrink-0 text-right text-xs text-slate-400">
                      {fmtNum(m.pedidos)} ped.
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Detalle */}
          <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex gap-1 p-2 border-b border-slate-100">
              {([['vendedores', 'Por vendedor'], ['productos', 'Por producto'], ['clientes', 'Por cliente']] as [Lista, string][]).map(([k, r]) => (
                <button key={k} onClick={() => setLista(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${lista === k
                    ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {r}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {lista === 'vendedores' && (
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">Vendedor</th>
                      <th className="text-right px-4 py-2.5">Pedidos</th>
                      <th className="text-right px-4 py-2.5">Clientes</th>
                      <th className="text-right px-4 py-2.5">L/kg</th>
                      <th className="text-right px-4 py-2.5">Facturación</th>
                      <th className="text-right px-4 py-2.5">Parte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.vendedores.map(v => (
                      <tr key={v.code} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-900">{v.name}</span>
                          <span className="text-slate-400"> ({v.code})</span>
                          {v.es_distribuidor && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                              distribuidor
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(v.pedidos)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(v.clientes)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(v.volumen)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtPesos.format(v.pesos)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">
                          {t.pesos > 0 ? Math.round((Number(v.pesos) / Number(t.pesos)) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {lista === 'productos' && (
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">Producto</th>
                      <th className="text-right px-4 py-2.5">L/kg</th>
                      <th className="text-right px-4 py-2.5">Bonificado</th>
                      <th className="text-right px-4 py-2.5">Facturación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.productos.map(p => (
                      <tr key={p.producto} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{p.producto}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(p.vendido)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-700">{p.bonificado ? fmtNum(p.bonificado) : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtPesos.format(p.pesos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {lista === 'clientes' && (
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">Cliente</th>
                      <th className="text-left px-4 py-2.5">Vendedor</th>
                      <th className="text-right px-4 py-2.5">Pedidos</th>
                      <th className="text-left px-4 py-2.5">Último</th>
                      <th className="text-right px-4 py-2.5">Facturación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.clientes.map((c, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-900">{c.cliente ?? '—'}</span>
                          {c.codigo && <span className="text-slate-400"> · {c.codigo}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{nombreVendedor(c.vendedor)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(c.pedidos)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{fechaCorta(c.ultimo)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtPesos.format(c.pesos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {datos.totales.pedidos === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                No hay pedidos aprobados con estos filtros.
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
