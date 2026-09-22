import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import FichaClienteVista from '../../components/FichaClienteVista';
import { listarVendedores, type Vendedor } from '../../lib/adminOrders';
import { fichaCliente, codigoVendedorWeb, type FichaCliente } from '../../lib/historial';

export default function ClienteFicha() {
  const { codigo = '' } = useParams();
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { listarVendedores().then(setVendedores).catch(() => {}); }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(null);
    fichaCliente(codigo)
      .then(f => { if (vigente) setFicha(f); })
      .catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [codigo]);

  const nombreVendedor = (cod: string | null) => {
    if (!cod) return '—';
    const web = codigoVendedorWeb(cod);
    const v = vendedores.find(x => x.code === web);
    return v ? `${v.name} (${web})` : `Vendedor ${cod}`;
  };

  if (cargando) {
    return (
      <AdminLayout crumbs={[{ label: 'Clientes', to: '/admin/clientes' }, { label: codigo }]}>
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Cargando el historial…</div>
      </AdminLayout>
    );
  }
  if (error || !ficha) {
    return (
      <AdminLayout crumbs={[{ label: 'Clientes', to: '/admin/clientes' }, { label: codigo }]}>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? `No existe el cliente ${codigo} en el sistema.`}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout crumbs={[{ label: 'Clientes', to: '/admin/clientes' }, { label: ficha.cliente.razon_social ?? codigo }]}>
      <Link to="/admin/clientes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </Link>
      <FichaClienteVista key={codigo} ficha={ficha} nombreVendedor={nombreVendedor} />
    </AdminLayout>
  );
}
