import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import PlanillaPedido, { Casilla, campo, type FuentesDeCliente } from '../../components/PlanillaPedido';
import { buscarClienteAdmin, datosDeClienteAdmin } from '../../lib/historial';
import { crearPedidoAdmin, listarVendedores, type Vendedor } from '../../lib/adminOrders';
import { NOMBRE_PROYECTO } from '../../lib/proyectos';

// Muchos pedidos llegan por mail a santiago@ y a ventas@. Acá se cargan a mano,
// con la misma planilla que usa el vendedor, eligiendo a quién corresponden:
// el pedido le aparece en su panel de ventas y cuenta en su estadística.

export default function NuevoPedido() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedor, setVendedor] = useState('');
  const [numero, setNumero] = useState<string | null>(null);
  // Cambiarlo desmonta y vuelve a montar la planilla: la deja en blanco.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    listarVendedores()
      .then(v => setVendedores(v.filter(x => x.active)))
      .catch(() => setVendedores([]));
  }, []);

  const elegido = vendedores.find(v => v.code === vendedor);

  // Memorizado: la planilla lo tiene como dependencia de sus efectos y un
  // objeto nuevo en cada dibujo la haría buscar sin parar.
  const fuentes = useMemo<FuentesDeCliente>(
    () => ({ datos: datosDeClienteAdmin, buscar: buscarClienteAdmin }),
    [],
  );

  // Si todavía no se eligió vendedor, se propone el que tiene el cliente en el
  // sistema viejo. Es solo una propuesta: se puede cambiar. Se propone únicamente
  // si ese código existe hoy: en el sistema viejo quedaron vendedores que ya no
  // están, y elegir uno de esos daría un pedido que la base rechaza.
  const proponerVendedor = useCallback((c: { vendedor?: string | null }) => {
    const codigo = c.vendedor;
    if (!codigo || !vendedores.some(v => v.code === codigo)) return;
    setVendedor(actual => actual || codigo);
  }, [vendedores]);

  if (numero !== null) {
    return (
      <AdminLayout crumbs={[{ label: 'Pedidos', to: '/admin/pedidos' }, { label: 'Cargar pedido' }]}>
        <div className="max-w-md mx-auto mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-1">Pedido cargado</h2>
          <div className="inline-block px-4 py-1 mb-3 rounded-full bg-slate-100 text-sm font-bold text-slate-700">
            N° {numero}
          </div>
          <p className="text-sm text-slate-500 mb-7">
            Quedó a nombre de {elegido ? `${elegido.name} (${elegido.code})` : 'el vendedor elegido'} y
            el mail con la planilla ya salió.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => { setNumero(null); setIntento(n => n + 1); window.scrollTo(0, 0); }}
              className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >Cargar otro</button>
            <Link to="/admin/pedidos"
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Ver los pedidos
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout crumbs={[{ label: 'Pedidos', to: '/admin/pedidos' }, { label: 'Cargar pedido' }]}>
      <PlanillaPedido
        key={intento}
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
        guardar={(input) => crearPedidoAdmin(input, vendedor)}
        alGuardar={(pedido) => { setNumero(pedido.order_number ?? ''); window.scrollTo(0, 0); }}
        validar={() => (vendedor ? [] : ['el código del agente al que corresponde el pedido'])}
        alEncontrarCliente={proponerVendedor}
        alElegirSugerencia={proponerVendedor}
        aviso={
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-semibold ${
            elegido?.proyecto === 'femway'
              ? 'bg-violet-50 border border-violet-200 text-violet-800'
              : 'bg-sky-50 border border-sky-200 text-sky-900'}`}>
            {elegido
              ? <>El pedido queda a nombre de <b>{elegido.name} ({elegido.code})</b> en {NOMBRE_PROYECTO[elegido.proyecto]}, y le aparece en su panel de ventas.</>
              : <>Elegí arriba el código del agente al que corresponde el pedido. El proyecto sale de su ficha.</>}
          </div>
        }
      />
    </AdminLayout>
  );
}
