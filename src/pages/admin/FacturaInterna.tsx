import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, FileDown, Loader2, Pencil, RefreshCw,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { fmtNum, fmtPesos } from '../../lib/adminOrders';
import {
  facturaInterna, guardarCostoQuimwey, mesesFacturaInterna,
  type ClaseComprobante, type ComprobanteInterno, type FacturaInterna as Datos,
} from '../../lib/facturaInterna';
import { elegirCarpeta, guardarEnCarpeta, sePuedeElegirCarpeta } from '../../lib/carpetaLocal';

// La factura interna de FEMAVI a FemWay, armada sola: lo que salió para FemWay
// en el mes según los comprobantes del sistema viejo, a costo de la lista de
// Quimwey. Si aparece un artículo sin costo, se carga acá mismo.
//
// Va por lo que salió: la bonificación no resta, lo sin cargo entra, las notas
// de crédito restan. La primera factura (octubre 2026) se lleva septiembre.

const PRIMER_MES = '2026-10-01';
const CARPETA_PDF = 'factura-interna';

const diaAR = (d: Date) =>
  d.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

/** De octubre 2026 al mes en curso, el más nuevo primero. */
function meses(): string[] {
  const hoy = diaAR(new Date());
  const fin = hoy.slice(0, 7) + '-01';
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

const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const CLASE: Record<ClaseComprobante, { rotulo: string; color: string }> = {
  remito: { rotulo: 'Remito', color: 'bg-slate-100 text-slate-700' },
  papelito: { rotulo: 'Papelito', color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  nota_credito: { rotulo: 'Nota de crédito', color: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
};

const pesos = (n: number | null) => (n == null ? '—' : fmtPesos.format(n));

function Tarjeta({ rotulo, valor, pie, fuerte }: { rotulo: string; valor: string; pie?: string; fuerte?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${fuerte ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${fuerte ? 'text-slate-400' : 'text-slate-400'}`}>{rotulo}</div>
      <div className={`text-xl font-bold ${fuerte ? 'text-white' : 'text-slate-900'}`}>{valor}</div>
      {pie && <div className={`text-[11px] mt-0.5 ${fuerte ? 'text-slate-400' : 'text-slate-400'}`}>{pie}</div>}
    </div>
  );
}

/** Un costo que se puede cargar o corregir en el lugar. */
function CampoCosto({ articulo, costo, alGuardar, abierto = false }: {
  articulo: string; costo: number | null; alGuardar: () => void; abierto?: boolean;
}) {
  const [editando, setEditando] = useState(abierto);
  const [valor, setValor] = useState(costo == null ? '' : String(costo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const limpio = valor.replace(/\./g, '').replace(',', '.').trim();
    const n = limpio === '' ? null : Number(limpio);
    if (n != null && (!Number.isFinite(n) || n < 0)) { setError('Número inválido'); return; }
    setGuardando(true);
    setError(null);
    try {
      await guardarCostoQuimwey(articulo, n);
      setEditando(abierto);
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <button onClick={() => setEditando(true)}
        className="group inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900">
        {pesos(costo)}
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60" />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-400 text-xs">$</span>
      <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" autoFocus={!abierto}
        onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape' && !abierto) setEditando(false); }}
        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-right" placeholder="costo" />
      <button onClick={guardar} disabled={guardando}
        className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-semibold disabled:opacity-50">
        {guardando ? '…' : 'Guardar'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

type Lista = 'productos' | 'comprobantes';

// Los comprobantes se ordenan tocando el encabezado. El primer toque va en el
// sentido que más se usa (fecha: lo más nuevo primero; importe: lo más caro);
// el segundo lo da vuelta.
type Columna = 'fecha' | 'comprobante' | 'pedido' | 'cliente' | 'importe';
type Orden = { col: Columna; desc: boolean };
const PRIMERO_DESC: Record<Columna, boolean> = { fecha: true, importe: true, comprobante: false, pedido: false, cliente: false };

function comparar(a: ComprobanteInterno, b: ComprobanteInterno, col: Columna): number {
  switch (col) {
    case 'fecha': return a.fecha.localeCompare(b.fecha) || a.comprobante - b.comprobante;
    case 'comprobante': return a.comprobante - b.comprobante;
    case 'pedido': return a.pedido - b.pedido || a.comprobante - b.comprobante;
    case 'cliente': return (a.cliente ?? '').localeCompare(b.cliente ?? '', 'es', { sensitivity: 'base' });
    case 'importe': return (a.importe ?? -Infinity) - (b.importe ?? -Infinity);
  }
}

function Encabezado({ col, rotulo, orden, alOrdenar, derecha }: {
  col: Columna; rotulo: string; orden: Orden | null; alOrdenar: (c: Columna) => void; derecha?: boolean;
}) {
  const activo = orden?.col === col;
  const Flecha = !activo ? ChevronsUpDown : orden.desc ? ChevronDown : ChevronUp;
  return (
    <th className={`px-4 py-2.5 ${derecha ? 'text-right' : 'text-left'}`}>
      <button onClick={() => alOrdenar(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900 ${activo ? 'text-slate-900' : ''}`}>
        {rotulo}
        <Flecha className={`w-3 h-3 ${activo ? '' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

export default function FacturaInterna() {
  // Arranca con los meses del calendario y después toma los de la base, que
  // abren un mes apenas hay un comprobante con esa fecha.
  const [opciones, setOpciones] = useState<string[]>(() => meses());
  const [mes, setMes] = useState(opciones[0]);
  useEffect(() => {
    mesesFacturaInterna()
      .then(m => { if (m.length) setOpciones(m); })
      .catch(() => {});
  }, []);
  const [lista, setLista] = useState<Lista>('productos');
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta(v => v + 1), []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    facturaInterna(mes)
      .then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError((e as Error).message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [mes, vuelta]);

  // El PDF va a FEMWEY\FACTURAS INTERNAS\<año>\OCTUBRE 2026.pdf: la carpeta
  // FACTURAS INTERNAS se elige una vez por navegador y la del año se crea sola.
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const exportarPdf = async (cambiarCarpeta = false) => {
    if (!datos) return;
    setExportando(true);
    setAviso(null);
    try {
      if (cambiarCarpeta && !(await elegirCarpeta(CARPETA_PDF))) return;
      const nombre = nombreMes(datos.mes).replace(' de ', ' ').toUpperCase() + '.pdf';
      const r = await guardarEnCarpeta(CARPETA_PDF, datos.mes.slice(0, 4), nombre, async () => {
        const pdf = await import('../../lib/facturaInternaPdf');
        return pdf.armarFacturaInternaPdf(datos, PRIMER_MES, await pdf.logoFemavi()).output('blob');
      });
      if ('ruta' in r) setAviso(`Guardado en ${r.ruta}`);
      else if ('descargado' in r) setAviso(`Descargado como ${nombre} (este navegador no deja elegir la carpeta).`);
    } catch (e) {
      setError('No se pudo guardar el PDF: ' + (e as Error).message);
    } finally {
      setExportando(false);
    }
  };

  const [orden, setOrden] = useState<Orden | null>(null);
  const ordenar = (col: Columna) =>
    setOrden(o => ({ col, desc: o?.col === col ? !o.desc : PRIMERO_DESC[col] }));
  const comprobantes = useMemo(() => {
    const lista = datos?.comprobantes ?? [];
    if (!orden) return lista;
    return [...lista].sort((a, b) => (orden.desc ? -1 : 1) * comparar(a, b, orden.col));
  }, [datos, orden]);

  const alternar = (n: number) =>
    setAbiertos(p => { const s = new Set(p); if (s.has(n)) s.delete(n); else s.add(n); return s; });

  const t = datos?.totales;
  const hoy = diaAR(new Date());
  const mesEnCurso = datos ? hoy <= datos.hasta : false;

  return (
    <AdminLayout
      crumbs={[{ label: 'Factura interna' }]}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => exportarPdf()} disabled={!datos || cargando || exportando}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Exportar PDF
          </button>
          <button onClick={recargar}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-500 mb-4 max-w-3xl">
        Lo que FEMAVI le factura a FemWay: la mercadería que salió en el mes según los remitos y
        papelitos del sistema viejo, a costo de la lista de Quimwey. La bonificación no resta, lo
        que va sin cargo entra y las notas de crédito restan.
      </p>

      {/* Mes */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {opciones.map(m => (
          <button key={m} onClick={() => { setMes(m); setAbiertos(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${mes === m
              ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {nombreMes(m)}
          </button>
        ))}
      </div>

      {aviso && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex flex-wrap items-center gap-x-3">
          {aviso}
          {sePuedeElegirCarpeta() && (
            <button onClick={() => exportarPdf(true)} className="text-xs underline text-emerald-700 hover:text-emerald-900">
              Cambiar carpeta
            </button>
          )}
        </div>
      )}

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {cargando && !datos ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Calculando…
        </div>
      ) : datos && t && (
        <div className={cargando ? 'opacity-60' : ''}>
          <div className="text-xs text-slate-400 mb-3">
            {datos.mes === PRIMER_MES
              ? <>Primera factura: incluye todo lo anterior, hasta el {fechaCorta(datos.hasta)}.</>
              : <>Del {fechaCorta(datos.desde)} al {fechaCorta(datos.hasta)}.</>}
            {mesEnCurso && datos.ultimo_comprobante && (
              <> Mes en curso: el último comprobante sincronizado es del {fechaCorta(datos.ultimo_comprobante)}.</>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <Tarjeta fuerte rotulo="A facturar a FemWay" valor={fmtPesos.format(t.costo)}
              pie={`${fmtNum(t.comprobantes)} comprobantes · ${fmtNum(t.kg)} L/kg`} />
            <Tarjeta rotulo="Remitos" valor={fmtPesos.format(t.remitos)} />
            <Tarjeta rotulo="Papelitos" valor={fmtPesos.format(t.papelitos)} pie="salen sin remito" />
            <Tarjeta rotulo="Notas de crédito" valor={fmtPesos.format(t.notas_credito)} pie="lo que volvió" />
            <Tarjeta rotulo="Sin cargo" valor={fmtPesos.format(t.sin_cargo)} pie="muestras, dispenser…" />
          </div>

          {/* Lo que no tiene costo no suma: tiene que verse antes que nada. */}
          {datos.sin_costo.length > 0 && (
            <section className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 mb-1">
                <AlertTriangle className="w-4 h-4" />
                {datos.sin_costo.length === 1 ? 'Un artículo sin costo' : `${datos.sin_costo.length} artículos sin costo`}
              </div>
              <p className="text-xs text-amber-700 mb-3">
                No suman a la factura hasta que tengan costo. Cargalo por L/kg (o por unidad si es un envase, dispenser, etc.).
              </p>
              <div className="space-y-2">
                {datos.sin_costo.map(s => (
                  <div key={s.articulo} className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="w-64 font-semibold text-slate-900">
                      {s.producto} <span className="text-slate-400 font-normal">({s.articulo})</span>
                    </span>
                    <span className="w-20 text-right text-slate-600">{fmtNum(s.kg)} L/kg</span>
                    <CampoCosto articulo={s.articulo} costo={null} alGuardar={recargar} abierto />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex gap-1 p-2 border-b border-slate-100">
              {([['productos', 'Por producto'], ['comprobantes', 'Comprobantes']] as [Lista, string][]).map(([k, r]) => (
                <button key={k} onClick={() => setLista(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${lista === k
                    ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {r}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {lista === 'productos' && (
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">Producto</th>
                      <th className="text-right px-4 py-2.5">Salió</th>
                      <th className="text-right px-4 py-2.5">Sin cargo</th>
                      <th className="text-right px-4 py-2.5">Volvió</th>
                      <th className="text-right px-4 py-2.5">Costo L/kg</th>
                      <th className="text-right px-4 py-2.5">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.productos.map(p => (
                      <tr key={p.articulo} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-900">{p.producto}</span>
                          <span className="text-slate-400"> ({p.articulo})</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(p.salio)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{p.sin_cargo ? fmtNum(p.sin_cargo) : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{p.volvio ? `−${fmtNum(p.volvio)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <CampoCosto key={`${p.articulo}-${p.costo}`} articulo={p.articulo} costo={p.costo} alGuardar={recargar} />
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${p.importe == null ? 'text-amber-600' : 'text-slate-900'}`}>
                          {p.importe == null ? 'sin costo' : fmtPesos.format(p.importe)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {lista === 'comprobantes' && (
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <tr>
                      <Encabezado col="fecha" rotulo="Fecha" orden={orden} alOrdenar={ordenar} />
                      <Encabezado col="comprobante" rotulo="Comprobante" orden={orden} alOrdenar={ordenar} />
                      <Encabezado col="pedido" rotulo="Pedido" orden={orden} alOrdenar={ordenar} />
                      <Encabezado col="cliente" rotulo="Cliente" orden={orden} alOrdenar={ordenar} />
                      <Encabezado col="importe" rotulo="Importe" orden={orden} alOrdenar={ordenar} derecha />
                    </tr>
                  </thead>
                  <tbody>
                    {comprobantes.map(c => {
                      const abierto = abiertos.has(c.comprobante);
                      return [
                        <tr key={c.comprobante} onClick={() => alternar(c.comprobante)}
                          className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-600">
                            {abierto ? <ChevronDown className="inline w-3.5 h-3.5 mr-1" /> : <ChevronRight className="inline w-3.5 h-3.5 mr-1" />}
                            {fechaCorta(c.fecha)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold mr-2 ${CLASE[c.clase].color}`}>
                              {CLASE[c.clase].rotulo}
                            </span>
                            <span className="font-semibold text-slate-900">{c.comprobante}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{c.pedido}</td>
                          <td className="px-4 py-2.5 text-slate-600">{c.cliente ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${c.importe != null && c.importe < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {pesos(c.importe)}
                          </td>
                        </tr>,
                        abierto && (
                          <tr key={`${c.comprobante}-d`} className="bg-slate-50/60">
                            <td colSpan={5} className="px-10 py-2">
                              <table className="w-full text-xs">
                                <tbody>
                                  {c.renglones.map((r, i) => (
                                    <tr key={i}>
                                      <td className="py-1 text-slate-700">
                                        {r.producto} <span className="text-slate-400">({r.articulo})</span>
                                        {r.sin_cargo && <span className="ml-2 text-[10px] text-slate-400">sin cargo</span>}
                                      </td>
                                      <td className="py-1 text-right text-slate-600 w-24">{fmtNum(r.kg)} L/kg</td>
                                      <td className="py-1 text-right text-slate-500 w-28">× {pesos(r.costo)}</td>
                                      <td className="py-1 text-right font-semibold text-slate-800 w-32">
                                        {r.importe == null ? <span className="text-amber-600">sin costo</span> : fmtPesos.format(r.importe)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {datos.comprobantes.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                Todavía no hay comprobantes de FemWay en este mes.
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
