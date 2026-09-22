import { Loader2, Phone, TrendingDown } from 'lucide-react';
import { fmtNum } from '../lib/adminOrders';
import { ETIQUETA_CAIDA, POR_PAGINA, type ClienteEnCaida, type FiltrosCaida, type TipoCaida } from '../lib/historial';

// Lista de clientes que se están cayendo. La comparten el admin (todos) y el
// vendedor (los suyos): cambia quién trae los datos, no la pantalla.

const COLOR: Record<TipoCaida, string> = {
  perdido: 'bg-red-50 text-red-700 ring-red-200',
  caida: 'bg-amber-50 text-amber-700 ring-amber-200',
  dormido: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export function hace(iso: string | null): string {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  if (dias < 31) return `hace ${dias} días`;
  if (dias < 365) return `hace ${Math.round(dias / 30)} meses`;
  const anios = Math.floor(dias / 365);
  return `hace ${anios} año${anios > 1 ? 's' : ''}`;
}

/** Un teléfono para llamar: el sistema guarda varios en un solo campo. */
const primerTelefono = (t: string | null) => (t ? t.split(/[/,;]| CEL | TEL /i)[0].trim() : '');

export const CAMPO = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

export function FiltrosCaidaBase({ filtros, set }: { filtros: FiltrosCaida; set: (p: Partial<FiltrosCaida>) => void }) {
  return (
    <>
      <select value={filtros.tipo ?? ''} onChange={e => set({ tipo: e.target.value as FiltrosCaida['tipo'] })} className={CAMPO}>
        <option value="">Todos</option>
        <option value="caida">Bajaron fuerte (40% o más)</option>
        <option value="perdido">Dejaron de comprar (último año)</option>
        <option value="dormido">Dormidos (2 a 4 años)</option>
      </select>
      <select value={filtros.orden} onChange={e => set({ orden: e.target.value as FiltrosCaida['orden'] })} className={CAMPO}>
        <option value="perdido">Más litros/kg perdidos</option>
        <option value="porcentaje">Mayor caída %</option>
        <option value="ultima">Compra más reciente</option>
      </select>
      <label className="text-sm text-slate-500 flex items-center gap-2">
        Desde
        <input type="number" min={1} value={filtros.min ?? ''} onChange={e => set({ min: Number(e.target.value) || undefined })}
          placeholder="1" className={CAMPO + ' w-24'} />
        L/kg al año
      </label>
    </>
  );
}

interface Props {
  filas: ClienteEnCaida[];
  cargando: boolean;
  error: string | null;
  pagina: number;
  onPagina: (p: number) => void;
  nombreVendedor?: (cod: string | null) => string;
  alAbrir: (codigo: string) => void;
}

export default function ListaEnCaida({ filas, cargando, error, pagina, onPagina, nombreVendedor, alAbrir }: Props) {
  const total = filas[0]?.total_filas ?? 0;
  const perdidoPagina = filas.reduce((s, c) => s + c.perdido, 0);

  return (
    <>
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className={`rounded-xl bg-white border border-slate-200 overflow-x-auto ${cargando && filas.length ? 'opacity-60' : ''}`}>
        {cargando && filas.length === 0 ? (
          <div className="flex items-center gap-2 p-8 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</div>
        ) : filas.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Ningún cliente se está cayendo con estos filtros. Buena noticia.</div>
        ) : (
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Cliente</th>
                {nombreVendedor && <th className="text-left px-4 py-3">Vendedor</th>}
                <th className="text-left px-4 py-3">Situación</th>
                <th className="text-left px-4 py-3">Última compra</th>
                <th className="text-right px-4 py-3">Antes</th>
                <th className="text-right px-4 py-3">Ahora</th>
                <th className="text-right px-4 py-3">L/kg por año</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(c => (
                <tr key={c.codigo} onClick={() => alAbrir(c.codigo)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-900">{c.razon_social ?? '—'}</span>
                    <span className="block text-xs text-slate-400">
                      Cód. {c.codigo}{c.localidad ? ` · ${c.localidad}` : ''}
                      {primerTelefono(c.telefonos) && (
                        <span className="inline-flex items-center gap-1 ml-2 text-slate-500">
                          <Phone className="w-3 h-3" />{primerTelefono(c.telefonos)}
                        </span>
                      )}
                    </span>
                  </td>
                  {nombreVendedor && <td className="px-4 py-3 text-slate-600">{nombreVendedor(c.vendedor)}</td>}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 whitespace-nowrap ${COLOR[c.tipo]}`}>
                      {ETIQUETA_CAIDA[c.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-slate-800">{fechaCorta(c.ultima_compra)}</span>
                    <span className="block text-xs text-slate-400">{hace(c.ultima_compra)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {fmtNum(c.tipo === 'dormido' ? c.perdido : c.volumen_12m_anterior)}
                    {c.tipo === 'dormido' && <span className="block text-[10px] text-slate-400">su último año</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNum(c.volumen_12m)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="font-bold text-red-600">−{fmtNum(c.perdido)}</span>
                    {c.caida_pct !== null && (
                      <span className="block text-xs text-slate-400">
                        <TrendingDown className="inline w-3 h-3 mr-0.5" />{c.caida_pct}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm text-slate-500">
          <span>
            {fmtNum(total)} clientes · mostrando {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, total)} ·
            {' '}en esta página se dejaron de vender <b className="text-slate-700">{fmtNum(perdidoPagina)}</b> L/kg al año
          </span>
          <div className="flex gap-2">
            <button disabled={pagina === 0} onClick={() => onPagina(pagina - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Anterior</button>
            <button disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => onPagina(pagina + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
    </>
  );
}
