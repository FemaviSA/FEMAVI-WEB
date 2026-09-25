import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import ConsultaArca from '../../components/ConsultaArca';
import FichaFemwayVista from '../../components/FichaFemwayVista';
import { listarVendedores, type Vendedor } from '../../lib/adminOrders';
import { fichaClienteFemway, type FichaFemway } from '../../lib/femway';

// La ficha de un cliente de FemWay vista por administración: la misma que ve el
// vendedor, más la edición de los datos y la consulta a ARCA.

export default function ClienteFemwayFicha() {
  const { codigo = '' } = useParams();
  const [ficha, setFicha] = useState<FichaFemway | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listarVendedores().then(setVendedores).catch(() => {}); }, []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFicha(await fichaClienteFemway(codigo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [codigo]);

  useEffect(() => { setCargando(true); cargar(); }, [cargar]);

  const nombreVendedor = (cod: string | null) => {
    if (!cod) return '—';
    const v = vendedores.find(x => x.code === cod);
    return v ? `${v.name} (${cod})` : `Vendedor ${cod}`;
  };

  const crumbs = [
    { label: 'Clientes', to: '/admin/clientes' },
    { label: ficha?.cliente.razon_social ?? codigo },
  ];

  if (cargando) {
    return (
      <AdminLayout crumbs={crumbs}>
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando la ficha…
        </div>
      </AdminLayout>
    );
  }
  if (error || !ficha) {
    return (
      <AdminLayout crumbs={crumbs}>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? `No existe el cliente ${codigo} en FemWay.`}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout crumbs={crumbs}>
      <Link to="/admin/clientes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft className="w-4 h-4" /> Volver a clientes
      </Link>

      <FichaFemwayVista
        key={codigo}
        ficha={ficha}
        nombreVendedor={nombreVendedor}
        mostrarFemavi
        vendedores={vendedores}
        alGuardar={cargar}
      />

      <details className="mt-6">
        <summary className="text-sm text-slate-500 cursor-pointer">Consultar este CUIT en ARCA</summary>
        <div className="mt-3">
          <ConsultaArca key={codigo} cuitInicial={ficha.cliente.cuit} razonPedido={ficha.cliente.razon_social} />
        </div>
      </details>
    </AdminLayout>
  );
}
