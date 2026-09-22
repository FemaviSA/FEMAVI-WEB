import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { listarVendedores, type Vendedor, fmtNum } from '../../lib/adminOrders';
import { buscarClientes, codigoVendedorWeb, POR_PAGINA, type ClienteLista, type FiltrosClientes } from '../../lib/historial';

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

/** "hace 3 meses", para ver de un vistazo quién dejó de comprar. */
function hace(iso: string | null): string {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  if (dias < 31) return `hace ${dias} días`;
  if (dias < 365) return `hace ${Math.round(dias / 30)} meses`;
  const anios = Math.floor(dias / 365);
  return `hace ${anios} año${anios > 1 ? 's' : ''}`;
}

export default function Clientes() {
  const [filtros, setFiltros] = useState<FiltrosClientes>({ orden: 'ultima', estado: '', pagina: 0 });
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<ClienteLista[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listarVendedores().then(setVendedores).catch(() => {}); }, []);

  // La búsqueda por texto espera a que se deje de tipear.
  useEffect(() => {
    const t = setTimeout(() => setFiltros(f => ({ ...f, q: texto, pagina: 0 })), 350);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    buscarClientes(filtros)
      .then(r => { if (vigente) setFilas(r); })
      .catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [filtros]);

  const nombreVendedor = useMemo(() => {
    const m = new Map(vendedores.map(v => [v.code, v.name]));
    return (cod: string | null) => {
      if (!cod) return '—';
      const web = codigoVendedorWeb(cod);
      return m.has(web) ? `${m.get(web)} (${web})` : `Vendedor ${cod}`;
    };
  }, [vendedores]);

  const total = filas[0]?.total_filas ?? 0;
  const pagina = filtros.pagina ?? 0;
  const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';
  const set = (p: Partial<FiltrosClientes>) => setFiltros(f => ({ ...f, ...p, pagina: 0 }));

  return (
    <AdminLayout crumbs={[{ label: 'Clientes' }]}>
      <p className="text-sm text-slate-500 mb-4">
        Historial del sistema de gestión desde 1995. Los volúmenes suman litros y kilos juntos, netos de notas de crédito.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input autoFocus value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Nombre, código, CUIT o localidad…" className={campo + ' pl-9 w-72'} />
        </div>
        <select value={filtros.vendedor ?? ''} onChange={e => set({ vendedor: e.target.value || undefined })} className={campo}>
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v.code} value={v.code.padStart(3, '0')}>{v.name} ({v.code})</option>)}
        </select>
        <select value={filtros.estado ?? ''} onChange={e => set({ estado: e.target.value as FiltrosClientes['estado'] })} className={campo}>
          <option value="">Todos</option>
          <option value="activos">Compraron en los últimos 12 meses</option>
          <option value="inactivos">No compran hace más de 12 meses</option>
          <option value="sin_compras">Nunca compraron</option>
        </select>
        <select value={filtros.orden} onChange={e => set({ orden: e.target.value as FiltrosClientes['orden'] })} className={campo}>
          <option value="ultima">Última compra más reciente</option>
          <option value="volumen_12m">Más volumen en 12 meses</option>
          <option value="volumen">Más volumen histórico</option>
          <option value="nombre">Nombre A-Z</option>
        </select>
        <input value={filtros.zona ?? ''} onChange={e => set({ zona: e.target.value.replace(/\D/g, '').slice(0, 3) || undefined })}
          placeholder="Zona" className={campo + ' w-20'} />
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
        {cargando && filas.length === 0 ? (
          <div className="flex items-center gap-2 p-8 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</div>
        ) : filas.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No hay clientes con estos filtros.</div>
        ) : (
          <table className={`w-full text-sm min-w-[860px] ${cargando ? 'opacity-60' : ''}`}>
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Cód.</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Vendedor</th>
                <th className="text-left px-4 py-3">Última compra</th>
                <th className="text-right px-4 py-3">Compras</th>
                <th className="text-right px-4 py-3">L/kg 12 meses</th>
                <th className="text-right px-4 py-3">L/kg histórico</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(c => {
                const sube = c.volumen_12m > c.volumen_12m_anterior;
                const baja = c.volumen_12m < c.volumen_12m_anterior;
                return (
                  <tr key={c.codigo} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400 font-mono">
                      <Link to={`/admin/clientes/${c.codigo}`} className="block">{c.codigo}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/clientes/${c.codigo}`} className="block">
                        <span className="font-semibold text-slate-900">{c.razon_social ?? '—'}</span>
                        <span className="block text-xs text-slate-400">{c.localidad ?? ''}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{nombreVendedor(c.vendedor)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-slate-800">{fechaCorta(c.ultima_compra)}</span>
                      <span className="block text-xs text-slate-400">{hace(c.ultima_compra)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmtNum(c.compras)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{fmtNum(c.volumen_12m)}</span>
                      {sube && <TrendingUp className="inline w-3.5 h-3.5 ml-1 text-emerald-600" aria-label="más que los 12 meses anteriores" />}
                      {baja && <TrendingDown className="inline w-3.5 h-3.5 ml-1 text-red-500" aria-label="menos que los 12 meses anteriores" />}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtNum(c.volumen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
          <span>{fmtNum(total)} clientes · mostrando {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, total)}</span>
          <div className="flex gap-2">
            <button disabled={pagina === 0} onClick={() => setFiltros(f => ({ ...f, pagina: pagina - 1 }))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Anterior</button>
            <button disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setFiltros(f => ({ ...f, pagina: pagina + 1 }))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
