import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import FichaFemwayVista from './FichaFemwayVista';
import { fmtNum, fmtPesos } from '../lib/adminOrders';
import { guardarMiNotaFemway, misClientesFemway, miFichaClienteFemway, type FichaFemway, type MiClienteFemway } from '../lib/femway';
import { PaseVencidoError } from '../lib/sellers';

// Clientes del vendedor de FemWay. Igual que la solapa de FEMAVI: se entra a
// cualquiera y se ve su ABM y su historial. Qué clientes son lo decide la base
// con el pase: acá no hay ningún filtro de vendedor que se pueda tocar.

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

interface Props {
  token: string;
  vendedor: { code: string; name: string };
  onPaseVencido: () => void;
}

export default function MisClientesFemway({ token, vendedor, onPaseVencido }: Props) {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState<MiClienteFemway[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [abierto, setAbierto] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaFemway | null>(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [errorFicha, setErrorFicha] = useState<string | null>(null);

  const falla = (e: unknown, set: (m: string) => void) => {
    if (e instanceof PaseVencidoError) onPaseVencido();
    else set((e as Error)?.message ?? 'No se pudo cargar.');
  };

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto), 350);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    misClientesFemway(token, busqueda)
      .then(r => { if (vigente) setFilas(r); })
      .catch(e => { if (vigente) falla(e, setError); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, busqueda]);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCargandoFicha(true);
    setErrorFicha(null);
    setFicha(null);
    window.scrollTo(0, 0);
    miFichaClienteFemway(token, abierto)
      .then(f => { if (vigente) f ? setFicha(f) : setErrorFicha('No se encontró el cliente.'); })
      .catch(e => { if (vigente) falla(e, setErrorFicha); })
      .finally(() => { if (vigente) setCargandoFicha(false); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, abierto]);

  const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {abierto && (
        <div>
          <button onClick={() => setAbierto(null)}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
            <ArrowLeft className="w-4 h-4" /> Volver a mis clientes
          </button>
          {cargandoFicha ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando la ficha…
            </div>
          ) : errorFicha || !ficha ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{errorFicha}</div>
          ) : (
            <FichaFemwayVista
              key={abierto}
              ficha={ficha}
              nombreVendedor={() => `${vendedor.name} (${vendedor.code})`}
              guardarNota={async n => {
                await guardarMiNotaFemway(token, abierto, n);
                setFicha(f => (f ? { ...f, cliente: { ...f.cliente, notas: n.trim() || null } } : f));
              }}
            />
          )}
        </div>
      )}

      {/* La lista queda montada mientras se ve una ficha, para volver al mismo lugar. */}
      <div style={{ display: abierto ? 'none' : undefined }}>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Mis clientes</h1>
        <p className="text-sm text-slate-500 mb-4">
          Tus clientes de FemWay. Entrá a cualquiera para ver sus datos y todo lo que te compró.
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Nombre, código, CUIT o localidad…" className={campo + ' pl-9 w-full max-w-md'} />
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className={`rounded-xl bg-white border border-slate-200 overflow-hidden ${cargando && filas.length ? 'opacity-60' : ''}`}>
          {cargando && filas.length === 0 ? (
            <div className="flex items-center gap-2 p-8 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando…
            </div>
          ) : filas.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {busqueda ? 'No hay clientes con esa búsqueda.' : 'Todavía no tenés clientes cargados.'}
            </div>
          ) : (
            <ul>
              {filas.map(c => (
                <li key={c.codigo} className="border-t first:border-t-0 border-slate-100">
                  <button onClick={() => setAbierto(c.codigo)}
                    className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                    <span className="flex-1 min-w-[180px]">
                      <span className="font-semibold text-slate-900">{c.razon_social}</span>
                      <span className="block text-xs text-slate-400">
                        Cód. {c.codigo}{c.cuit ? ` · CUIT ${c.cuit}` : ''}{c.localidad ? ` · ${c.localidad}` : ''}
                      </span>
                    </span>
                    <span className="w-44 text-sm text-right">
                      <span className="text-slate-800">{fechaCorta(c.ultima_compra)}</span>
                      <span className="block text-xs text-slate-400">
                        {c.pedidos === 0
                          ? 'todavía no compró'
                          : `${c.pedidos} pedido${c.pedidos > 1 ? 's' : ''} · ${fmtNum(c.volumen)} L/kg · ${fmtPesos.format(c.comprado)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {filas.length > 0 && (
          <p className="mt-3 text-sm text-slate-500">{fmtNum(filas.length)} clientes</p>
        )}
      </div>
    </div>
  );
}
