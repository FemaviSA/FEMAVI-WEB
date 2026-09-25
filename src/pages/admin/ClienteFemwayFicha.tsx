import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Pencil, X } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import ConsultaArca from '../../components/ConsultaArca';
import { fmtNum, fmtPesos, listarVendedores, ETIQUETA_ESTADO, type Estado, type Vendedor } from '../../lib/adminOrders';
import { fichaClienteFemway, guardarClienteFemway, type DatosClienteFemway, type FichaFemway } from '../../lib/femway';

// La ficha de un cliente de FemWay: los mismos datos del ABM que en FEMAVI, más
// lo que compró. La diferencia es que acá la historia son los pedidos de la web
// —no hay sistema viejo detrás— y que estos datos se pueden editar, porque el
// registro de FemWay es nuestro.

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

function Numerito({ rotulo, valor, detalle }: { rotulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</div>
      <div className="text-xl font-bold text-slate-900">{valor}</div>
      {detalle && <div className="text-xs text-slate-400">{detalle}</div>}
    </div>
  );
}

export default function ClienteFemwayFicha() {
  const { codigo = '' } = useParams();
  const [ficha, setFicha] = useState<FichaFemway | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set());

  useEffect(() => { listarVendedores().then(setVendedores).catch(() => {}); }, []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFicha(await fichaClienteFemway(codigo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [codigo]);

  useEffect(() => { setCargando(true); cargar(); }, [cargar]);

  const nombreVendedor = (cod: string | null) => {
    if (!cod) return '—';
    const v = vendedores.find(x => x.code === cod);
    return v ? `${v.name} (${cod})` : `Vendedor ${cod}`;
  };

  const crumbs = [
    { label: 'Clientes', to: '/admin/clientes' },
    { label: ficha?.cliente.razon_social ?? codigo },
  ];

  if (cargando) {
    return (
      <AdminLayout crumbs={crumbs}>
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando la ficha…
        </div>
      </AdminLayout>
    );
  }
  if (error || !ficha) {
    return (
      <AdminLayout crumbs={crumbs}>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? `No existe el cliente ${codigo} en FemWay.`}
        </div>
      </AdminLayout>
    );
  }

  const c = ficha.cliente;
  const r = ficha.resumen;
  const alternar = (id: number) =>
    setAbiertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <AdminLayout crumbs={crumbs}>
      <Link to="/admin/clientes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </Link>

      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{c.razon_social}</h1>
          {c.origen === 'femavi' ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 ring-1 ring-sky-200">
              También en FEMAVI · pasado el {fecha(c.pasado_el)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
              Nuevo de FemWay
            </span>
          )}
        </div>
        <div className="text-sm text-slate-500">
          Cód. {c.codigo} · CUIT {c.cuit ?? '—'} · {nombreVendedor(c.vendedor)} · Zona {c.zona ?? '—'}
        </div>
      </div>

      {/* Lo que compró */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Numerito rotulo="Pedidos" valor={fmtNum(Number(r?.pedidos ?? 0))} />
        <Numerito rotulo="Comprado" valor={fmtPesos.format(Number(r?.pesos ?? 0))} />
        <Numerito rotulo="Litros / kilos" valor={fmtNum(Number(r?.volumen ?? 0))} detalle="neto de bonificaciones" />
        <Numerito rotulo="Última compra" valor={fecha(r?.ultima_compra ?? null)}
          detalle={r?.primera_compra ? `cliente desde ${fecha(r.primera_compra)}` : undefined} />
      </div>

      {/* Datos del cliente */}
      <section className="rounded-xl bg-white border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700">Datos del cliente</h2>
          <button onClick={() => setEditando(e => !e)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900">
            {editando ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}
          </button>
        </div>

        {editando ? (
          <FormularioDatos
            cliente={c}
            vendedores={vendedores.filter(v => v.proyecto === 'femway' && v.active)}
            onListo={() => { setEditando(false); cargar(); }}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
            <Dato rotulo="Domicilio" valor={c.domicilio} />
            <Dato rotulo="Localidad" valor={c.localidad} />
            <Dato rotulo="Teléfonos" valor={c.telefonos} />
            <Dato rotulo="Responsable de compras" valor={c.resp_compras} />
            <Dato rotulo="Entrega" valor={[c.entrega_domicilio, c.entrega_localidad].filter(Boolean).join(', ')} />
            <Dato rotulo="Teléfono de entrega" valor={c.entrega_telefono} />
            <Dato rotulo="Zona" valor={c.zona} />
            <Dato rotulo="Vendedor" valor={nombreVendedor(c.vendedor)} />
            {c.origen === 'femavi' && <Dato rotulo="Código en FEMAVI" valor={c.cliente_femavi} />}
            <Dato rotulo="Notas" valor={c.notas} />
          </div>
        )}
      </section>

      {/* Qué compró */}
      {ficha.productos.length > 0 && (
        <section className="rounded-xl bg-white border border-slate-200 p-4 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Qué compra</h2>
          <table className="w-full text-sm">
            <thead className="text-[11px] text-slate-500 uppercase">
              <tr>
                <th className="text-left py-2">Producto</th>
                <th className="text-right py-2">L/kg</th>
                <th className="text-right py-2">Pesos</th>
                <th className="text-right py-2">Veces</th>
                <th className="text-right py-2">Última vez</th>
              </tr>
            </thead>
            <tbody>
              {ficha.productos.map(p => (
                <tr key={p.producto} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{p.producto}</td>
                  <td className="py-2 text-right">{fmtNum(Number(p.volumen))}</td>
                  <td className="py-2 text-right">{fmtPesos.format(Number(p.pesos))}</td>
                  <td className="py-2 text-right text-slate-500">{p.veces}</td>
                  <td className="py-2 text-right text-slate-500 whitespace-nowrap">{fecha(p.ultima_vez)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Historial de compras */}
      <section className="rounded-xl bg-white border border-slate-200 p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Historial de compras</h2>
        {ficha.pedidos.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no compró nada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="w-6" />
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Pedido</th>
                  <th className="text-left py-2">Vendedor</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {ficha.pedidos.map(p => {
                  const abierto = abiertos.has(p.id);
                  return (
                    <Fragment key={p.id}>
                      <tr onClick={() => alternar(p.id)} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                        <td className="py-2 text-slate-400">{abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                        <td className="py-2 whitespace-nowrap">{fecha(p.fecha)}</td>
                        <td className="py-2 font-semibold">
                          {p.numero}
                          {/* Se cargó como cliente nuevo: se le atribuye por el CUIT. */}
                          {p.sin_codigo && <span className="ml-1.5 text-[10px] text-slate-400">por CUIT</span>}
                        </td>
                        <td className="py-2 text-slate-600">{nombreVendedor(p.vendedor)}</td>
                        <td className="py-2">{ETIQUETA_ESTADO[p.estado as Estado] ?? p.estado}</td>
                        <td className="py-2 text-right font-semibold">{fmtPesos.format(Number(p.total) || 0)}</td>
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
        {ficha.por_anio.length > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-4">
            {ficha.por_anio.map(a => (
              <div key={a.anio} className="text-xs">
                <span className="font-bold text-slate-700">{a.anio}</span>
                <span className="text-slate-500">
                  {' '}· {a.pedidos} {a.pedidos === 1 ? 'pedido' : 'pedidos'}
                  {' '}· {fmtNum(Number(a.volumen))} L/kg · {fmtPesos.format(Number(a.pesos))}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <details className="mt-6">
        <summary className="text-sm text-slate-500 cursor-pointer">Consultar este CUIT en ARCA</summary>
        <div className="mt-3">
          <ConsultaArca key={codigo} cuitInicial={c.cuit} razonPedido={c.razon_social} />
        </div>
      </details>
    </AdminLayout>
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
