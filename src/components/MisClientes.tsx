import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import FichaClienteVista from './FichaClienteVista';
import { fmtNum } from '../lib/adminOrders';
import { misClientes, miFichaCliente, misArticulosSugeridos, POR_PAGINA, type ClienteLista, type FichaCliente, type FiltrosClientes } from '../lib/historial';
import FiltrosAvanzados from './FiltrosClientes';
import { PaseVencidoError } from '../lib/sellers';

// Clientes del vendedor que inició sesión. Qué clientes son lo decide la base
// con el token: acá no hay ningún filtro de vendedor que se pueda tocar.

type Filtros = Omit<FiltrosClientes, 'vendedor' | 'zona'>;

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

function hace(iso: string | null): string {
  if (!iso) return 'nunca compró';
  const dias = Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  if (dias < 31) return `hace ${dias} días`;
  if (dias < 365) return `hace ${Math.round(dias / 30)} meses`;
  const anios = Math.floor(dias / 365);
  return `hace ${anios} año${anios > 1 ? 's' : ''}`;
}

interface Props {
  token: string;
  vendedor: { code: string; name: string };
  onPaseVencido: () => void;
}

export default function MisClientes({ token, vendedor, onPaseVencido }: Props) {
  const [filtros, setFiltros] = useState<Filtros>({ orden: 'ultima', estado: '', pagina: 0 });
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<ClienteLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [abierto, setAbierto] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [errorFicha, setErrorFicha] = useState<string | null>(null);

  const falla = (e: unknown, set: (m: string) => void) => {
    if (e instanceof PaseVencidoError) onPaseVencido();
    else set((e as Error)?.message ?? 'No se pudo cargar.');
  };

  useEffect(() => {
    const t = setTimeout(() => setFiltros(f => ({ ...f, q: texto, pagina: 0 })), 350);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    misClientes(token, filtros)
      .then(r => { if (vigente) setFilas(r); })
      .catch(e => { if (vigente) falla(e, setError); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filtros]);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCargandoFicha(true);
    setErrorFicha(null);
    setFicha(null);
    window.scrollTo(0, 0);
    miFichaCliente(token, abierto)
      .then(f => { if (vigente) f ? setFicha(f) : setErrorFicha('No se encontró el cliente.'); })
      .catch(e => { if (vigente) falla(e, setErrorFicha); })
      .finally(() => { if (vigente) setCargandoFicha(false); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, abierto]);

  const total = filas[0]?.total_filas ?? 0;
  const pagina = filtros.pagina ?? 0;
  const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';
  const set = (p: Partial<Filtros>) => setFiltros(f => ({ ...f, ...p, pagina: 0 }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {abierto && (
        <div>
          <button onClick={() => setAbierto(null)}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
            <ArrowLeft className="w-4 h-4" /> Volver a mis clientes
          </button>
          {cargandoFicha ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Cargando el historial…</div>
          ) : errorFicha || !ficha ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errorFicha}</div>
          ) : (
            <FichaClienteVista key={abierto} ficha={ficha} nombreVendedor={() => `${vendedor.name} (${vendedor.code})`} />
          )}
        </div>
      )}

      {/* La lista queda montada mientras se ve una ficha, para volver al mismo lugar. */}
      <div style={{ display: abierto ? 'none' : undefined }}>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Mis clientes</h1>
        <p className="text-sm text-slate-500 mb-4">
          Los clientes con tu código en el sistema. Entrá a cualquiera para ver sus datos y todo su historial de compras.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={texto} onChange={e => setTexto(e.target.value)}
              placeholder="Nombre, código, CUIT o localidad…" className={campo + ' pl-9 w-full'} />
          </div>
          <select value={filtros.orden} onChange={e => set({ orden: e.target.value as Filtros['orden'] })} className={campo}>
            <option value="ultima">Última compra más reciente</option>
            <option value="nombre">Nombre A-Z</option>
          </select>
        </div>

        <FiltrosAvanzados filtros={filtros} set={set} sugerir={q => misArticulosSugeridos(token, q)} />

        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className={`rounded-xl bg-white border border-slate-200 overflow-hidden ${cargando && filas.length ? 'opacity-60' : ''}`}>
          {cargando && filas.length === 0 ? (
            <div className="flex items-center gap-2 p-8 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</div>
          ) : filas.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No hay clientes con estos filtros.</div>
          ) : (
            <ul>
              {filas.map(c => (
                <li key={c.codigo} className="border-t first:border-t-0 border-slate-100">
                  <button onClick={() => setAbierto(c.codigo)}
                    className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                    <span className="flex-1 min-w-[180px]">
                      <span className="font-semibold text-slate-900">{c.razon_social ?? '—'}</span>
                      <span className="block text-xs text-slate-400">
                        Cód. {c.codigo}{c.cuit ? ` · CUIT ${c.cuit}` : ''}{c.localidad ? ` · ${c.localidad}` : ''}
                      {filtros.producto && c.ultima_vez_producto ? ` · ese producto: ${fechaCorta(c.ultima_vez_producto)}` : ''}
                      </span>
                    </span>
                    <span className="w-32 text-sm text-right">
                      <span className="text-slate-800">{fechaCorta(c.ultima_compra)}</span>
                      <span className="block text-xs text-slate-400">{hace(c.ultima_compra)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm text-slate-500">
            <span>{fmtNum(total)} clientes · mostrando {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, total)}</span>
            <div className="flex gap-2">
              <button disabled={pagina === 0} onClick={() => setFiltros(f => ({ ...f, pagina: pagina - 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Anterior</button>
              <button disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setFiltros(f => ({ ...f, pagina: pagina + 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
