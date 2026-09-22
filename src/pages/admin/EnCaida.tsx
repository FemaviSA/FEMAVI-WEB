import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import ListaEnCaida, { CAMPO, FiltrosCaidaBase } from '../../components/ListaEnCaida';
import { listarVendedores, type Vendedor } from '../../lib/adminOrders';
import { clientesEnCaida, codigoVendedorWeb, type ClienteEnCaida, type FiltrosCaida } from '../../lib/historial';

export default function EnCaida() {
  const navegar = useNavigate();
  const [filtros, setFiltros] = useState<FiltrosCaida>({ orden: 'perdido', tipo: '', pagina: 0 });
  const [filas, setFilas] = useState<ClienteEnCaida[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listarVendedores().then(setVendedores).catch(() => {}); }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    clientesEnCaida(filtros)
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

  const set = (p: Partial<FiltrosCaida>) => setFiltros(f => ({ ...f, ...p, pagina: 0 }));

  return (
    <AdminLayout crumbs={[{ label: 'Se están cayendo' }]}>
      <p className="text-sm text-slate-500 mb-4">
        Clientes que compraban y bajaron, dejaron de comprar o están dormidos. La columna final son los litros/kg
        por año que se dejaron de vender: por ahí se empieza. Tocá un cliente para ver su ficha completa.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={filtros.vendedor ?? ''} onChange={e => set({ vendedor: e.target.value || undefined })} className={CAMPO}>
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v.code} value={v.code.padStart(3, '0')}>{v.name} ({v.code})</option>)}
        </select>
        <FiltrosCaidaBase filtros={filtros} set={set} />
        <input value={filtros.zona ?? ''} onChange={e => set({ zona: e.target.value.replace(/\D/g, '').slice(0, 3) || undefined })}
          placeholder="Zona" className={CAMPO + ' w-20'} />
      </div>

      <ListaEnCaida
        filas={filas} cargando={cargando} error={error}
        pagina={filtros.pagina ?? 0} onPagina={p => setFiltros(f => ({ ...f, pagina: p }))}
        nombreVendedor={nombreVendedor}
        alAbrir={codigo => navegar(`/admin/clientes/${codigo}`)}
      />

      <p className="text-xs text-slate-400 mt-4">
        Se comparan los últimos 12 meses contra los 12 anteriores. Para un cliente dormido se toma lo que compraba
        en su último año activo. Los que no compran hace más de 4 años no se listan.
      </p>
    </AdminLayout>
  );
}
