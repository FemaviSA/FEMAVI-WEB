import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw, Search } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import PedidoDetalle, { ChipEstado } from './PedidoDetalle';
import {
  type Pedido, type Vendedor, type Estado, ESTADOS, ETIQUETA_ESTADO,
  listarPedidos, listarVendedores, volumenDe, fmtNum, fmtPesos, fmtFecha, exportarCsv,
} from '../../lib/adminOrders';

type Pestaña = Estado | 'todos';

// Día en hora argentina (AAAA-MM-DD). Con toISOString un pedido de las 22 hs
// caería en el día siguiente.
const diaAR = (d: Date | string) =>
  new Date(d).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const hoy = () => diaAR(new Date());

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Arranca en "Recibidos": lo primero que hay que mirar es lo que espera aprobación.
  const [pestaña, setPestaña] = useState<Pestaña>('recibido');
  const [vendedor, setVendedor] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [p, v] = await Promise.all([listarPedidos(), listarVendedores()]);
      setPedidos(p);
      setVendedores(v);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudieron cargar los pedidos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const nombreVendedor = useCallback((code: string | null) => {
    if (!code) return 'Web (cliente)';
    const v = vendedores.find(x => x.code === code);
    return v ? `${v.name} (${code})` : `Agente ${code}`;
  }, [vendedores]);

  // Todo menos el estado: sobre esto se cuentan las pestañas.
  const filtradosSinEstado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pedidos.filter(p => {
      if (vendedor && (p.seller_code ?? '') !== vendedor) return false;
      if (cuenta && p.account !== cuenta) return false;
      const dia = diaAR(p.created_at);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
      if (q) {
        const texto = [p.order_number, p.company, p.client_code, p.bill_city, p.cuit].join(' ').toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [pedidos, vendedor, cuenta, desde, hasta, busqueda]);

  const conteo = useMemo(() => {
    const c: Record<string, number> = { todos: filtradosSinEstado.length };
    for (const e of ESTADOS) c[e] = 0;
    for (const p of filtradosSinEstado) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [filtradosSinEstado]);

  const visibles = useMemo(
    () => (pestaña === 'todos' ? filtradosSinEstado : filtradosSinEstado.filter(p => p.status === pestaña)),
    [filtradosSinEstado, pestaña],
  );

  // Los rechazados no suman, salvo que se esté mirando justamente esa pestaña.
  const totales = useMemo(() => {
    const t = { pesos: 0, litros: 0, kilos: 0, unidades: 0, bonificado: 0 };
    for (const p of visibles) {
      if (p.status === 'rechazado' && pestaña !== 'rechazado') continue;
      const v = volumenDe(p.items);
      t.pesos += Number(p.total) || 0;
      t.litros += v.litros; t.kilos += v.kilos; t.unidades += v.unidades; t.bonificado += v.bonificado;
    }
    return t;
  }, [visibles, pestaña]);

  const pedidoAbierto = pedidos.find(p => p.id === abierto) ?? null;
  const hayFiltros = vendedor || cuenta || desde || hasta || busqueda;

  const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

  return (
    <AdminLayout
      crumbs={[{ label: 'Pedidos' }]}
      actions={
        <div className="flex gap-2">
          <button onClick={() => { setCargando(true); cargar(); }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button onClick={() => exportarCsv(visibles, nombreVendedor)} disabled={!visibles.length}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">
            <Download className="w-4 h-4" /> Exportar a Excel
          </button>
        </div>
      }
    >
      {/* Pestañas por estado */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {(['recibido', 'aprobado', 'ingresado', 'facturado', 'entregado', 'rechazado', 'todos'] as Pestaña[]).map(e => (
          <button key={e} onClick={() => setPestaña(e)}
            className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition ${
              pestaña === e ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {e === 'todos' ? 'Todos' : ETIQUETA_ESTADO[e]}
            <span className={`ml-2 text-xs ${pestaña === e ? 'text-slate-300' : 'text-slate-400'}`}>{conteo[e] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="N°, cliente, CUIT, ciudad…"
            className={campo + ' pl-9 w-56'} />
        </div>
        <select value={vendedor} onChange={e => setVendedor(e.target.value)} className={campo}>
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v.code} value={v.code}>{v.name} ({v.code})</option>)}
        </select>
        <select value={cuenta} onChange={e => setCuenta(e.target.value)} className={campo}>
          <option value="">C1 y C2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>
        <input type="date" value={desde} max={hasta || hoy()} onChange={e => setDesde(e.target.value)} className={campo} title="Desde" />
        <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} className={campo} title="Hasta" />
        {hayFiltros && (
          <button onClick={() => { setVendedor(''); setCuenta(''); setDesde(''); setHasta(''); setBusqueda(''); }}
            className="text-sm text-slate-500 underline px-2">Limpiar</button>
        )}
      </div>

      {/* Totales de lo que se está viendo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { r: 'Pedidos', v: fmtNum(visibles.length) },
          { r: 'Facturación', v: fmtPesos.format(totales.pesos) },
          { r: 'Litros', v: fmtNum(totales.litros) },
          { r: 'Kilos', v: fmtNum(totales.kilos) + (totales.unidades ? ` · ${fmtNum(totales.unidades)} u` : '') },
        ].map(t => (
          <div key={t.r} className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t.r}</div>
            <div className="text-xl font-bold text-slate-900">{t.v}</div>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Lista */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
        {cargando ? (
          <div className="flex items-center gap-2 p-8 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : visibles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {pedidos.length === 0 ? 'Todavía no entró ningún pedido.' : 'No hay pedidos con estos filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">N°</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Vendedor</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Cta.</th>
                <th className="text-right px-4 py-3">Volumen</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(p => {
                const v = volumenDe(p.items);
                return (
                  <tr key={p.id} onClick={() => setAbierto(p.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-slate-900">{p.order_number ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtFecha(p.created_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{nombreVendedor(p.seller_code)}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {p.company ?? '—'}
                      {p.is_new_client
                        ? <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-1.5 py-0.5 rounded">NUEVO</span>
                        : p.client_code && <span className="ml-2 text-xs text-slate-400">#{p.client_code}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-semibold">{p.account ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                      {[v.litros && `${fmtNum(v.litros)} L`, v.kilos && `${fmtNum(v.kilos)} kg`, v.unidades && `${fmtNum(v.unidades)} u`].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{fmtPesos.format(Number(p.total) || 0)}</td>
                    <td className="px-4 py-3"><ChipEstado estado={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pedidoAbierto && (
        <PedidoDetalle
          pedido={pedidoAbierto}
          vendedor={nombreVendedor(pedidoAbierto.seller_code)}
          onCerrar={() => setAbierto(null)}
          onCambio={cargar}
        />
      )}
    </AdminLayout>
  );
}
