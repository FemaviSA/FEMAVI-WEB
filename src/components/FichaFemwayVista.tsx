import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Pencil, X } from 'lucide-react';
import { fmtNum, fmtPesos, ETIQUETA_ESTADO, type Estado, type Vendedor } from '../lib/adminOrders';
import { guardarClienteFemway, type DatosClienteFemway, type FichaFemway } from '../lib/femway';

// La ficha de un cliente de FemWay, armada igual que la de FEMAVI: los datos
// del ABM y el historial de compras, nada más. La usan el admin y el vendedor;
// el vendedor la ve sin poder editar, igual que en FEMAVI.

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

interface Props {
  ficha: FichaFemway;
  nombreVendedor: (cod: string | null) => string;
  /**
   * Si el cliente también es de FEMAVI. Es cosa de administración: al vendedor
   * de FemWay no le aporta y lo confunde, así que solo se muestra en el admin.
   */
  mostrarFemavi?: boolean;
  /** Solo administración edita los datos del cliente. */
  vendedores?: Vendedor[];
  alGuardar?: () => void;
}

/** Montarla con key={codigo} para que el estado se reinicie al cambiar de cliente. */
export default function FichaFemwayVista({ ficha, nombreVendedor, mostrarFemavi, vendedores, alGuardar }: Props) {
  const [editando, setEditando] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
  const [anio, setAnio] = useState<number | 'todos'>('todos');

  const puedeEditar = !!vendedores && !!alGuardar;
  const c = ficha.cliente;
  const r = ficha.resumen;
  const anios = [...new Set((ficha.pedidos ?? []).map(p => (p.fecha ?? '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const pedidos = (ficha.pedidos ?? []).filter(p => anio === 'todos' || (p.fecha ?? '').startsWith(String(anio)));
  const alternar = (id: number) =>
    setAbiertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{c.razon_social}</h1>
          {mostrarFemavi && c.origen === 'femavi' && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${c.pasado_el
              ? 'bg-sky-50 text-sky-700 ring-sky-200'
              : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
              También en FEMAVI{c.pasado_el ? '' : ' · sin confirmar'}
            </span>
          )}
        </div>
        <div className="text-sm text-slate-500">
          Cód. {c.codigo} · CUIT {c.cuit ?? '—'} · {nombreVendedor(c.vendedor)} · Zona {c.zona ?? '—'}
        </div>
      </div>

      {/* Datos del cliente, el ABM */}
      <section className="rounded-xl bg-white border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700">Datos del cliente</h2>
          {puedeEditar && (
            <button onClick={() => setEditando(e => !e)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900">
              {editando ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}
            </button>
          )}
        </div>

        {editando && puedeEditar ? (
          <FormularioDatos
            cliente={c}
            vendedores={vendedores!.filter(v => v.proyecto === 'femway' && v.active)}
            onListo={() => { setEditando(false); alGuardar!(); }}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
            <Dato rotulo="Domicilio" valor={c.domicilio} />
            <Dato rotulo="Localidad" valor={c.localidad} />
            <Dato rotulo="Teléfonos" valor={c.telefonos} />
            <Dato rotulo="Responsable de compras" valor={c.resp_compras} />
            <Dato rotulo="Cliente desde" valor={fecha(r?.primera_compra ?? c.pasado_el)} />
            <Dato rotulo="Última compra" valor={fecha(r?.ultima_compra ?? null)} />
            <Dato rotulo="Entrega" valor={[c.entrega_domicilio, c.entrega_localidad].filter(Boolean).join(', ')} />
            <Dato rotulo="Teléfono de entrega" valor={c.entrega_telefono} />
            <Dato rotulo="Zona" valor={c.zona} />
            {mostrarFemavi && c.origen === 'femavi' && <Dato rotulo="Código en FEMAVI" valor={c.cliente_femavi} />}
            <Dato rotulo="Notas" valor={c.notas} />
          </div>
        )}
      </section>

      {/* Historial de compras */}
      <section className="rounded-xl bg-white border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-700">Historial de compras</h2>
          {anios.length > 1 && (
            <select value={anio} onChange={e => setAnio(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
              <option value="todos">Todos los años</option>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        {pedidos.length === 0 ? <p className="text-sm text-slate-400">Sin compras.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="w-6" />
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Pedido</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-right py-2">L/kg</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => {
                  const abierto = abiertos.has(p.id);
                  const kilos = (p.items ?? []).reduce((s, x) => s + (Number(x.quantity) || 0), 0);
                  return (
                    <Fragment key={p.id}>
                      <tr onClick={() => alternar(p.id)} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                        <td className="py-2 text-slate-400">{abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                        <td className="py-2 whitespace-nowrap">{fecha(p.fecha)}</td>
                        <td className="py-2">
                          {p.numero}
                          {/* Se cargó como cliente nuevo: se le atribuye por el CUIT. */}
                          {p.sin_codigo && <span className="ml-1.5 text-[10px] text-slate-400">por CUIT</span>}
                        </td>
                        <td className="py-2">{ETIQUETA_ESTADO[p.estado as Estado] ?? p.estado}</td>
                        <td className="py-2 text-right font-semibold">{fmtNum(kilos)}</td>
                        <td className="py-2 text-right">{fmtPesos.format(Number(p.total) || 0)}</td>
                      </tr>
                      {abierto && (
                        <tr className="bg-slate-50">
                          <td />
                          <td colSpan={5} className="py-2">
                            <table className="w-full text-xs">
                              <thead className="text-slate-400 uppercase">
                                <tr>
                                  <th className="text-left py-1">Producto</th>
                                  <th className="text-right">Envase</th>
                                  <th className="text-right">L/kg</th>
                                  <th className="text-right">Precio</th>
                                  <th className="text-right">Importe</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(p.items ?? []).map((it, i) => {
                                  const bonif = Number(it.quantity) < 0;
                                  return (
                                    <tr key={i} className={`border-t border-slate-200 ${bonif ? 'text-emerald-700 font-semibold' : ''}`}>
                                      <td className="py-1">{bonif ? 'BONIFICACIÓN — ' : ''}{it.product}</td>
                                      <td className="text-right">{it.presentation || '—'}</td>
                                      <td className="text-right">{fmtNum(Number(it.quantity) || 0)}</td>
                                      <td className="text-right">{fmtPesos.format(Number(it.unit_price) || 0)}</td>
                                      <td className="text-right">{fmtPesos.format(Number(it.line_total) || 0)}</td>
                                    </tr>
                                  );
                                })}
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
        <p className="text-xs text-slate-400 mt-3">
          Las bonificaciones van en verde y restan. Los pedidos rechazados no se cuentan.
        </p>
      </section>
    </>
  );
}

// ── Edición de los datos ──

function FormularioDatos({ cliente, vendedores, onListo }: {
  cliente: DatosClienteFemway; vendedores: Vendedor[]; onListo: () => void;
}) {
  const [f, setF] = useState({
    razon_social: cliente.razon_social ?? '', cuit: cliente.cuit ?? '',
    domicilio: cliente.domicilio ?? '', localidad: cliente.localidad ?? '',
    telefonos: cliente.telefonos ?? '', resp_compras: cliente.resp_compras ?? '',
    entrega_domicilio: cliente.entrega_domicilio ?? '', entrega_localidad: cliente.entrega_localidad ?? '',
    entrega_telefono: cliente.entrega_telefono ?? '', zona: cliente.zona ?? '',
    vendedor: cliente.vendedor ?? '', notas: cliente.notas ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 w-full mt-1';
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await guardarClienteFemway({ codigo: cliente.codigo, ...f });
      onListo();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  };

  const Campo = ({ rot, k }: { rot: string; k: keyof typeof f }) => (
    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
      {rot}
      <input value={f[k]} onChange={set(k)} className={campo} />
    </label>
  );

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
        <Campo rot="Razón social" k="razon_social" />
        <Campo rot="CUIT" k="cuit" />
        <Campo rot="Domicilio" k="domicilio" />
        <Campo rot="Localidad" k="localidad" />
        <Campo rot="Teléfonos" k="telefonos" />
        <Campo rot="Responsable de compras" k="resp_compras" />
        <Campo rot="Domicilio de entrega" k="entrega_domicilio" />
        <Campo rot="Localidad de entrega" k="entrega_localidad" />
        <Campo rot="Teléfono de entrega" k="entrega_telefono" />
        <Campo rot="Zona" k="zona" />
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          Vendedor
          <select value={f.vendedor} onChange={set('vendedor')} className={campo}>
            <option value="">—</option>
            {vendedores.map(v => <option key={v.code} value={v.code}>{v.name} ({v.code})</option>)}
          </select>
        </label>
        <Campo rot="Notas" k="notas" />
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      <button onClick={guardar} disabled={!f.razon_social.trim() || guardando}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
      </button>
    </>
  );
}
