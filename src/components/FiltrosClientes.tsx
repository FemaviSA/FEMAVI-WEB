import { useEffect, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { ArticuloSugerido, FiltrosClientes as Filtros } from '../lib/historial';

// Filtros para armar listas de clientes sin pedirlas: sin compras entre dos
// fechas, por producto, por localidad. Los usan el vendedor (sobre su cartera)
// y el admin (sobre todos). Están plegados para no ensuciar la pantalla.

const CAMPO = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

interface Props {
  filtros: Filtros;
  set: (p: Partial<Filtros>) => void;
  /** Busca productos para sugerir; depende de quién mira. */
  sugerir: (q: string) => Promise<ArticuloSugerido[]>;
}

export function hayFiltrosAvanzados(f: Filtros): boolean {
  return Boolean(f.localidad || f.sinDesde || f.sinHasta || f.producto || f.dejoProducto || f.atrasados);
}

export default function FiltrosClientes({ filtros, set, sugerir }: Props) {
  const [abierto, setAbierto] = useState(() => hayFiltrosAvanzados(filtros));
  const [textoProducto, setTextoProducto] = useState(filtros.producto ?? '');
  const [sugerencias, setSugerencias] = useState<ArticuloSugerido[]>([]);

  // Sugerencias de producto mientras se escribe.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (textoProducto.trim().length < 3) { setSugerencias([]); return; }
      setSugerencias(await sugerir(textoProducto.trim()));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoProducto]);

  const limpiar = () => {
    setTextoProducto('');
    setSugerencias([]);
    set({ localidad: undefined, sinDesde: undefined, sinHasta: undefined, atrasados: false,
          producto: undefined, prodDesde: undefined, prodHasta: undefined, dejoProducto: false });
  };

  return (
    <div className="mb-4">
      <button onClick={() => setAbierto(a => !a)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
          hayFiltrosAvanzados(filtros)
            ? 'border-sky-300 bg-sky-50 text-sky-800'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
        <SlidersHorizontal className="w-4 h-4" />
        {hayFiltrosAvanzados(filtros) ? 'Filtros activos' : 'Más filtros'}
      </button>

      {abierto && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          {/* Atrasados contra su propio ritmo */}
          <label className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={filtros.atrasados ?? false}
              onChange={e => set({ atrasados: e.target.checked })} />
            <span className="text-sm text-slate-700">
              <b>Atrasados según su propio ritmo</b>
              <span className="block text-xs text-slate-500">
                El que compra cada 45 días y hace 3 meses que no compra aparece; el que compra cada 6
                meses, no. Hacen falta 3 compras en los últimos 3 años para saber su ritmo.
              </span>
            </span>
          </label>

          {/* Sin compras en un período */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1.5">
              Clientes sin compras entre dos fechas
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <input type="date" value={filtros.sinDesde ?? ''} max={filtros.sinHasta || undefined}
                onChange={e => set({ sinDesde: e.target.value || undefined })} className={CAMPO} />
              <span>y</span>
              <input type="date" value={filtros.sinHasta ?? ''} min={filtros.sinDesde || undefined}
                onChange={e => set({ sinHasta: e.target.value || undefined })} className={CAMPO} />
              <span className="text-xs text-slate-400">
                Con una sola fecha alcanza: desde esa fecha en adelante, o hasta esa fecha.
              </span>
            </div>
          </div>

          {/* Producto */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Que compren un producto</div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input value={textoProducto}
                  onChange={e => { setTextoProducto(e.target.value); set({ producto: e.target.value || undefined }); }}
                  placeholder="Nombre o código del producto…" className={CAMPO + ' w-72'} />
                {sugerencias.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {sugerencias.map(a => (
                      <li key={a.codigo}>
                        <button
                          onClick={() => { setTextoProducto(a.descripcion ?? a.codigo); set({ producto: a.descripcion ?? a.codigo }); setSugerencias([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                          {a.descripcion ?? a.codigo}
                          <span className="block text-xs text-slate-400">{a.codigo} · {a.clientes} clientes</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={filtros.dejoProducto ?? false}
                  onChange={e => set({ dejoProducto: e.target.checked })} />
                y dejaron de comprarlo (hace más de un año)
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-600">
              <span className="text-xs text-slate-400">Se lo compraron entre</span>
              <input type="date" value={filtros.prodDesde ?? ''}
                onChange={e => set({ prodDesde: e.target.value || undefined })} className={CAMPO} />
              <span>y</span>
              <input type="date" value={filtros.prodHasta ?? ''}
                onChange={e => set({ prodHasta: e.target.value || undefined })} className={CAMPO} />
              <span className="text-xs text-slate-400">(opcional)</span>
            </div>
          </div>

          {/* Localidad */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Localidad
              <input value={filtros.localidad ?? ''} onChange={e => set({ localidad: e.target.value || undefined })}
                placeholder="Por ejemplo, Castelar" className={CAMPO + ' block mt-1 w-56'} />
            </label>
            {hayFiltrosAvanzados(filtros) && (
              <button onClick={limpiar}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
                <X className="w-4 h-4" /> Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
