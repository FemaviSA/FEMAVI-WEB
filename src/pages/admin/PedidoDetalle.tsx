import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Check, Ban, History, ShieldCheck } from 'lucide-react';
import ControlesPedido from '../../components/ControlesPedido';
import ConsultaArca from '../../components/ConsultaArca';
import {
  type Pedido, type CambioEstado, type Estado, ETIQUETA_ESTADO, SIGUIENTE,
  cambiarEstado, completarDatos, historialDe, volumenDe, fmtNum, fmtPesos,
} from '../../lib/adminOrders';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const COLOR_ESTADO: Record<Estado, string> = {
  recibido: 'bg-amber-50 text-amber-700 ring-amber-200',
  aprobado: 'bg-sky-50 text-sky-700 ring-sky-200',
  ingresado: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  facturado: 'bg-violet-50 text-violet-700 ring-violet-200',
  entregado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rechazado: 'bg-red-50 text-red-700 ring-red-200',
};

export function ChipEstado({ estado }: { estado: Estado }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${COLOR_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado] ?? estado}
    </span>
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

export default function PedidoDetalle({
  pedido, vendedor, onCerrar, onCambio,
}: {
  pedido: Pedido;
  vendedor: string;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [historial, setHistorial] = useState<CambioEstado[]>([]);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ciclo, setCiclo] = useState(pedido.sales_cycle ?? '');
  const [nroCliente, setNroCliente] = useState(pedido.client_code ?? '');

  useEffect(() => {
    historialDe(pedido.id).then(setHistorial).catch(() => setHistorial([]));
  }, [pedido.id, pedido.status]);

  const v = volumenDe(pedido.items);
  const siguiente = SIGUIENTE[pedido.status];

  const hacer = async (fn: () => Promise<void>) => {
    setError(null);
    setTrabajando(true);
    try {
      await fn();
      onCambio();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar.');
    } finally {
      setTrabajando(false);
    }
  };

  const datosCambiados = ciclo !== (pedido.sales_cycle ?? '') || nroCliente !== (pedido.client_code ?? '');
  // El ciclo es de FEMAVI: son mensuales pero el corte va variando, así que se
  // cargan a mano y hay que decir a cuál pertenece el pedido. FemWay se mide por
  // mes calendario y no necesita nada.
  const usaCiclos = pedido.proyecto === 'femavi';
  // Los doce meses del año del pedido: el ciclo de FEMAVI es un mes, y cuál le
  // toca lo decide administración porque el corte va variando.
  const mesesDelPedido = useMemo(() => {
    const anio = new Date(pedido.created_at).getFullYear();
    return MESES.map(m => m + ' ' + anio);
  }, [pedido.created_at]);
  const faltaCiclo = usaCiclos && !!siguiente && !ciclo.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCerrar} />
      <aside className="relative w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900">Pedido {pedido.order_number ?? '—'}</h2>
              <ChipEstado estado={pedido.status} />
              {pedido.account && <span className="text-xs font-bold text-slate-500">{pedido.account}</span>}
            </div>
            <div className="text-sm text-slate-500">{vendedor} · {new Date(pedido.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
          </div>
          <button onClick={onCerrar} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {pedido.status === 'rechazado' && pedido.rejection_reason && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              <strong>Motivo del rechazo:</strong> {pedido.rejection_reason}
            </div>
          )}
          {pedido.is_new_client && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <strong>Cliente nuevo.</strong> Cuando le asignen número, cargalo abajo: así sus próximos pedidos se reconocen como del mismo cliente.
            </div>
          )}

          {/* Controles: lo que hay que mirar antes de aprobar */}
          {pedido.status === 'recibido' && (
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                <ShieldCheck className="w-4 h-4" /> Antes de aprobar
              </h3>
              <ControlesPedido orderId={pedido.id} recargar={pedido.status} />
              <div className="mt-3">
                <ConsultaArca cuitInicial={pedido.cuit} orderId={pedido.id}
                  razonPedido={pedido.company} automatico />
              </div>
            </section>
          )}

          {/* Fuera del momento de aprobar, queda a mano pero sin consultar sola */}
          {pedido.status !== 'recibido' && (
            <ConsultaArca cuitInicial={pedido.cuit} orderId={pedido.id} razonPedido={pedido.company} />
          )}

          {/* Acciones */}
          {pedido.status !== 'rechazado' && pedido.status !== 'entregado' && (
            <section className="rounded-xl border border-slate-200 p-4">
              {!rechazando ? (
                <div className="flex flex-wrap gap-2">
                  {siguiente && (
                    <button
                      // Sin ciclo no se aprueba: la base lo rechaza igual, pero
                      // conviene que el botón lo diga antes de apretarlo.
                      disabled={trabajando || faltaCiclo}
                      title={faltaCiclo ? 'Elegí primero a qué ciclo pertenece el pedido' : undefined}
                      onClick={() => hacer(async () => {
                        // Si se eligió el ciclo y no se guardó, se guarda ahora.
                        if (datosCambiados) {
                          await completarDatos(pedido.id, {
                            sales_cycle: ciclo.trim() || null, client_code: nroCliente.trim() || null,
                          });
                        }
                        await cambiarEstado(pedido.id, siguiente.estado);
                      })}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                    >
                      {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {siguiente.accion}
                    </button>
                  )}
                  {faltaCiclo && (
                    <span className="self-center text-xs text-amber-800">
                      Elegí abajo a qué ciclo pertenece el pedido.
                    </span>
                  )}
                  <button
                    disabled={trabajando}
                    onClick={() => setRechazando(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" /> Rechazar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Motivo del rechazo (lo ve el vendedor)
                  </label>
                  <textarea
                    autoFocus value={motivo} onChange={e => setMotivo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[70px]"
                    placeholder="Ej: cliente con deuda vencida, precio por debajo de lista…"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={trabajando || !motivo.trim()}
                      onClick={() => hacer(() => cambiarEstado(pedido.id, 'rechazado', motivo.trim()))}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                    >Confirmar rechazo</button>
                    <button onClick={() => { setRechazando(false); setMotivo(''); }}
                      className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
                  </div>
                </div>
              )}
              {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
            </section>
          )}

          {/* Datos que completa administración */}
          <section className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Ciclo de ventas
                  {usaCiclos
                    ? pedido.status === 'recibido' && <span className="text-red-600"> · obligatorio para aprobar</span>
                    : <span className="text-slate-400"> · FemWay mide por mes</span>}
                </span>
                {/* Se elige de los meses: el corte del ciclo va variando, así que
                    a qué mes pertenece el pedido lo decide administración. */}
                <select value={ciclo} onChange={e => setCiclo(e.target.value)} disabled={!usaCiclos}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">{usaCiclos ? '— elegir el ciclo —' : '— no aplica —'}</option>
                  {mesesDelPedido.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {/* Si el pedido quedó con un ciclo de otro año. */}
                  {ciclo && !mesesDelPedido.includes(ciclo) && <option value={ciclo}>{ciclo}</option>}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">N° de cliente</span>
                <input value={nroCliente} onChange={e => setNroCliente(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" />
              </label>
            </div>
            {datosCambiados && (
              <button
                disabled={trabajando}
                onClick={() => hacer(() => completarDatos(pedido.id, {
                  sales_cycle: ciclo.trim() || null, client_code: nroCliente.trim() || null,
                }))}
                className="mt-3 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
              >Guardar</button>
            )}
          </section>

          {/* Productos */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Productos</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Cant.</th>
                    <th className="text-left px-3 py-2">Envase</th>
                    <th className="text-left px-3 py-2">Producto</th>
                    <th className="text-right px-3 py-2">Unitario</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.items.map((it, i) => {
                    const bonif = Number(it.quantity) < 0;
                    const importe = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                    return (
                      <tr key={i} className={`border-t border-slate-100 ${bonif ? 'bg-emerald-50 text-emerald-800' : ''}`}>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">{fmtNum(Number(it.quantity))}</td>
                        <td className="px-3 py-2">{it.presentation || '—'}</td>
                        <td className="px-3 py-2">{bonif && <span className="text-[10px] font-bold mr-1">BONIF.</span>}{it.product}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPesos.format(Number(it.unit_price) || 0)}</td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmtPesos.format(importe)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs text-slate-500">
                      {fmtNum(v.volumen)} L/kg{v.bonificado ? ` · ${fmtNum(v.bonificado)} bonificados` : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-slate-500">TOTAL</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{fmtPesos.format(Number(pedido.total) || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Cliente */}
          <section className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Facturar a</h3>
              <Dato rotulo="Razón social" valor={pedido.company} />
              <Dato rotulo="N° de cliente" valor={pedido.is_new_client ? 'Cliente nuevo' : pedido.client_code} />
              <Dato rotulo="Dirección fiscal" valor={[pedido.bill_address, pedido.bill_city].filter(Boolean).join(', ')} />
              <Dato rotulo="CUIT · IVA" valor={[pedido.cuit, pedido.tax_condition].filter(Boolean).join(' · ')} />
              <Dato rotulo="Condición de pago" valor={pedido.payment_terms} />
              <Dato rotulo="WhatsApp · E-mail" valor={[pedido.phone, pedido.email].filter(Boolean).join(' · ')} />
              <Dato rotulo="A cargo de" valor={pedido.client_name} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Entregar a</h3>
              <Dato rotulo="Dirección" valor={[pedido.delivery_address, pedido.ship_city].filter(Boolean).join(', ') || 'Donde siempre'} />
              <Dato rotulo="Transporte · Zona" valor={[pedido.carrier, pedido.zone].filter(Boolean).join(' · ')} />
              <Dato rotulo="WhatsApp · A cargo de" valor={[pedido.ship_phone, pedido.ship_contact].filter(Boolean).join(' · ')} />
              <Dato rotulo="Fecha de envío" valor={pedido.ship_date} />
              <Dato rotulo="Orden de compra" valor={pedido.purchase_order} />
            </div>
          </section>

          {pedido.notes && (
            <section className="rounded-lg bg-slate-50 border-l-4 border-slate-300 px-4 py-3 text-sm text-slate-700">
              <strong>Observaciones:</strong> {pedido.notes}
            </section>
          )}

          {/* Historial */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              <History className="w-3.5 h-3.5" /> Historial
            </h3>
            <ol className="space-y-2">
              {historial.map(h => (
                <li key={h.id} className="flex items-start gap-3 text-sm">
                  <span className="text-slate-400 whitespace-nowrap w-28 shrink-0">
                    {new Date(h.changed_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className="text-slate-700">
                    <ChipEstado estado={h.to_status as Estado} />
                    <span className="ml-2 text-slate-500">{h.changed_by ?? ''}</span>
                    {h.note && <span className="block text-slate-600 mt-0.5">“{h.note}”</span>}
                  </span>
                </li>
              ))}
              {historial.length === 0 && <li className="text-sm text-slate-400">Sin movimientos registrados.</li>}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
