import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import PlanillaPedido, { Casilla, campo, type FuentesDeCliente } from '../../components/PlanillaPedido';
import { buscarClienteAdmin, datosDeClienteAdmin, buscarClienteFemwayAdmin, datosDeClienteFemwayAdmin } from '../../lib/historial';
import { editarPedidoAdmin, listarVendedores, obtenerPedido, type Pedido, type Vendedor } from '../../lib/adminOrders';
import { useProyectoAdmin } from '../../hooks/useProyectoAdmin';
import { NOMBRE_PROYECTO } from '../../lib/proyectos';

// Administración corrige un pedido ya cargado, aunque esté aprobado: la misma
// planilla, con los datos del pedido. No cambia el número ni el estado, y no
// vuelve a mandar el mail. La edición queda en el historial del pedido.

export default function EditarPedido() {
  const { id } = useParams();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedor, setVendedor] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const { proyecto: proyectoFijo } = useProyectoAdmin();

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerPedido(Number(id)), listarVendedores()])
      .then(([p, v]) => {
        if (!vigente) return;
        setPedido(p);
        setVendedor(p?.seller_code ?? '');
        // El vendedor solo puede pasar a otro del mismo proyecto del pedido.
        setVendedores(v.filter(x => x.active && x.proyecto === p?.proyecto));
      })
      .catch(e => { if (vigente) setError((e as Error).message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id]);

  const elegido = vendedores.find(v => v.code === vendedor);
  const companeros = useMemo(
    () => vendedores.filter(v => v.code !== vendedor),
    [vendedores, vendedor],
  );
  const deFemway = pedido?.proyecto === 'femway';
  const fuentes = useMemo<FuentesDeCliente>(
    () => (deFemway
      ? { datos: datosDeClienteFemwayAdmin, buscar: buscarClienteFemwayAdmin }
      : { datos: datosDeClienteAdmin, buscar: buscarClienteAdmin }),
    [deFemway],
  );

  const titulo = `Editar pedido ${pedido?.order_number ?? ''}`.trim();
  const crumbs = [{ label: 'Pedidos', to: '/admin/pedidos' }, { label: titulo }];

  if (cargando) {
    return (
      <AdminLayout crumbs={crumbs}>
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Cargando el pedido…</div>
      </AdminLayout>
    );
  }

  if (error || !pedido || (proyectoFijo && pedido.proyecto !== proyectoFijo)) {
    return (
      <AdminLayout crumbs={crumbs}>
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? 'No se encontró el pedido.'}
        </div>
      </AdminLayout>
    );
  }

  if (guardado) {
    return (
      <AdminLayout crumbs={crumbs}>
        <div className="max-w-md mx-auto mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-1">Cambios guardados</h2>
          <p className="text-sm text-slate-500 mb-7">
            El pedido {pedido.order_number} quedó corregido y la edición figura en su historial.
            El mail no se vuelve a mandar.
          </p>
          <Link to="/admin/pedidos"
            className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            Volver a los pedidos
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout crumbs={crumbs}>
      <PlanillaPedido
        inicial={pedido}
        textoBoton="Guardar cambios"
        avisar={false}
        casillasAgente={
          <>
            <Casilla rot="Código del agente *" span={2}>
              <select
                value={vendedor} onChange={e => setVendedor(e.target.value)}
                style={{ ...campo, cursor: 'pointer', fontWeight: 700 }}
              >
                <option value="">elegir…</option>
                {vendedores.map(v => (
                  <option key={v.code} value={v.code}>{v.code}</option>
                ))}
              </select>
            </Casilla>
            <Casilla rot="Nombre del agente" span={2}>
              <span style={{ ...campo, display: 'block', fontWeight: 700 }}>
                {elegido ? elegido.name : '—'}
              </span>
            </Casilla>
          </>
        }
        cliente={fuentes}
        companeros={companeros}
        guardar={(input) => editarPedidoAdmin(pedido.id, input, vendedor)}
        alGuardar={() => { setGuardado(true); window.scrollTo(0, 0); }}
        validar={() => (vendedor ? [] : ['el código del agente al que corresponde el pedido'])}
        aviso={
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-semibold ${
            pedido.proyecto === 'femway'
              ? 'bg-violet-50 border border-violet-200 text-violet-800'
              : 'bg-sky-50 border border-sky-200 text-sky-900'}`}>
            Estás editando el pedido {pedido.order_number} de {NOMBRE_PROYECTO[pedido.proyecto]}. El número y el estado
            no cambian, y el mail no se vuelve a mandar.
          </div>
        }
      />
    </AdminLayout>
  );
}
