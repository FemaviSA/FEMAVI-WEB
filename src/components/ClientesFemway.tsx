import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { buscarClienteAdmin, type ClienteSugerido } from '../lib/historial';
import {
  borrarClienteFemway, clientesFemway, guardarClienteFemway, pasarClienteAFemway,
  type ClienteFemway,
} from '../lib/femway';
import { fmtNum, type Vendedor } from '../lib/adminOrders';

// Los clientes de FemWay. La parte que importa es "traer de FEMAVI": el mismo
// cliente pasa a existir en los dos proyectos, con el mismo código. El de
// FEMAVI queda intacto, con su historial y su vendedor de siempre.

const campo = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export default function ClientesFemway({ vendedores }: { vendedores: Vendedor[] }) {
  const deFemway = vendedores.filter(v => v.proyecto === 'femway' && v.active);

  const [filas, setFilas] = useState<ClienteFemway[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'pase' | 'alta' | null>(null);

  const cargar = useCallback(async (q: string) => {
    setError(null);
    try {
      setFilas(await clientesFemway(q));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setCargando(true); cargar(texto); }, 300);
    return () => clearTimeout(t);
  }, [texto, cargar]);

  const borrar = async (c: ClienteFemway) => {
    if (!confirm(`¿Sacar a ${c.razon_social} de FemWay? En FEMAVI no cambia nada.`)) return;
    try {
      await borrarClienteFemway(c.codigo);
      cargar(texto);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Código, razón social, CUIT o localidad…" className={campo + ' pl-9 w-80'} />
        </div>
        <button onClick={() => setPanel(panel === 'pase' ? null : 'pase')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
          <ArrowRightLeft className="w-4 h-4" /> Traer un cliente de FEMAVI
        </button>
        <button onClick={() => setPanel(panel === 'alta' ? null : 'alta')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
          <Plus className="w-4 h-4" /> Cliente nuevo
        </button>
      </div>

      {panel === 'pase' && (
        <PanelPase vendedores={deFemway} onListo={() => { setPanel(null); cargar(texto); }} onCerrar={() => setPanel(null)} />
      )}
      {panel === 'alta' && (
        <PanelAlta vendedores={deFemway} onListo={() => { setPanel(null); cargar(texto); }} onCerrar={() => setPanel(null)} />
      )}

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
        {cargando && filas.length === 0 ? (
          <div className="flex items-center gap-2 p-8 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</div>
        ) : filas.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            FemWay todavía no tiene clientes cargados. Traé uno de FEMAVI o dalo de alta nuevo.
          </div>
        ) : (
          <table className={`w-full text-sm min-w-[820px] ${cargando ? 'opacity-60' : ''}`}>
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Cód.</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">CUIT</th>
                <th className="text-left px-4 py-3">Vendedor</th>
                <th className="text-left px-4 py-3">Origen</th>
                <th className="text-right px-4 py-3">Pedidos</th>
                <th className="text-left px-4 py-3">Último</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map(c => (
                <tr key={c.codigo} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 font-mono">
                    <Link to={`/admin/clientes/femway/${c.codigo}`} className="block">{c.codigo}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/clientes/femway/${c.codigo}`} className="block">
                      <span className="font-semibold text-slate-900">{c.razon_social}</span>
                      <span className="block text-xs text-slate-400">{c.localidad ?? ''}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.cuit ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.vendedor ? (vendedores.find(v => v.code === c.vendedor)?.name ?? '') + ` (${c.vendedor})` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.origen === 'femavi' ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 ring-1 ring-sky-200">
                        También en FEMAVI
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 ring-1 ring-violet-200">
                        Nuevo de FemWay
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-800">{fmtNum(c.pedidos)}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fecha(c.ultimo_pedido)}</td>
                  <td className="px-2 py-3">
                    <button onClick={() => borrar(c)} title="Sacar de FemWay"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Traer un cliente que ya está en FEMAVI ──

function PanelPase({ vendedores, onListo, onCerrar }: {
  vendedores: Vendedor[]; onListo: () => void; onCerrar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState<ClienteSugerido[]>([]);
  const [elegido, setElegido] = useState<ClienteSugerido | null>(null);
  const [vendedor, setVendedor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (elegido || texto.trim().length < 3) { setOpciones([]); return; }
    const t = setTimeout(() => { buscarClienteAdmin(texto.trim()).then(setOpciones).catch(() => setOpciones([])); }, 300);
    return () => clearTimeout(t);
  }, [texto, elegido]);

  const pasar = async () => {
    if (!elegido || !vendedor) return;
    setGuardando(true);
    setError(null);
    try {
      await pasarClienteAFemway(elegido.codigo, vendedor);
      onListo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-violet-900">Traer un cliente de FEMAVI</h3>
          <p className="text-xs text-violet-800/80 mt-0.5">
            Se copian sus datos a FemWay con el mismo código. En FEMAVI no cambia nada: sigue con su
            historial y su vendedor de siempre.
          </p>
        </div>
        <button onClick={onCerrar} className="p-1 text-violet-400 hover:text-violet-700"><X className="w-4 h-4" /></button>
      </div>

      {!elegido ? (
        <div className="relative max-w-lg">
          <input autoFocus value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Razón social o CUIT del cliente de FEMAVI…" className={campo + ' w-full'} />
          {opciones.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {opciones.map(o => (
                <li key={o.codigo}>
                  <button onClick={() => { setElegido(o); if (o.vendedor && vendedores.some(v => v.code === o.vendedor)) setVendedor(o.vendedor); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="font-semibold text-slate-800">{o.razon_social}</span>
                    <span className="block text-xs text-slate-400">
                      Cód. {o.codigo}{o.localidad ? ` · ${o.localidad}` : ''}{o.vendedor ? ` · vendedor ${o.vendedor} en FEMAVI` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
            <div className="text-sm font-semibold text-slate-900">{elegido.razon_social}</div>
            <div className="text-xs text-slate-400">Cód. {elegido.codigo} · CUIT {elegido.cuit ?? '—'}</div>
          </div>
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Vendedor de FemWay
            <select value={vendedor} onChange={e => setVendedor(e.target.value)} className={campo + ' block mt-1 w-56'}>
              <option value="">elegir…</option>
              {vendedores.map(v => <option key={v.code} value={v.code}>{v.name} ({v.code})</option>)}
            </select>
          </label>
          <button onClick={pasar} disabled={!vendedor || guardando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Traer a FemWay
          </button>
          <button onClick={() => { setElegido(null); setTexto(''); }}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">Cambiar</button>
        </div>
      )}

      {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  );
}

// ── Alta de un cliente que nace en FemWay ──

function PanelAlta({ vendedores, onListo, onCerrar }: {
  vendedores: Vendedor[]; onListo: () => void; onCerrar: () => void;
}) {
  const [f, setF] = useState({
    razon_social: '', cuit: '', domicilio: '', localidad: '', telefonos: '',
    resp_compras: '', zona: '', vendedor: '', notas: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await guardarClienteFemway(f);
      onListo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const Campo = ({ rot, k, ancho = 'w-56' }: { rot: string; k: keyof typeof f; ancho?: string }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase">
      {rot}
      <input value={f[k]} onChange={set(k)} className={campo + ` block mt-1 ${ancho}`} />
    </label>
  );

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Cliente nuevo de FemWay</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            El que no existe en FEMAVI. Toma un código propio de FemWay, arriba de los del sistema viejo.
          </p>
        </div>
        <button onClick={onCerrar} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Campo rot="Razón social *" k="razon_social" ancho="w-72" />
        <Campo rot="CUIT" k="cuit" ancho="w-44" />
        <Campo rot="Domicilio" k="domicilio" ancho="w-72" />
        <Campo rot="Localidad" k="localidad" />
        <Campo rot="Teléfonos" k="telefonos" />
        <Campo rot="A cargo de" k="resp_compras" />
        <Campo rot="Zona" k="zona" ancho="w-28" />
        <label className="text-xs font-semibold text-slate-500 uppercase">
          Vendedor de FemWay
          <select value={f.vendedor} onChange={set('vendedor')} className={campo + ' block mt-1 w-56'}>
            <option value="">elegir…</option>
            {vendedores.map(v => <option key={v.code} value={v.code}>{v.name} ({v.code})</option>)}
          </select>
        </label>
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      <button onClick={guardar} disabled={!f.razon_social.trim() || guardando}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
      </button>
    </div>
  );
}
