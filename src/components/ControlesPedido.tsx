import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { controlesDePedido, fmtPesos, type ControlesPedido as Controles } from '../lib/adminOrders';
import { NOMBRE_PROYECTO } from '../lib/proyectos';

// Lo que hay que mirar antes de aprobar un pedido. Son avisos: la decisión
// sigue siendo de administración, nada se bloquea.

const fecha = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

function Fila({ tono, icono, titulo, children }: {
  tono: 'ok' | 'aviso' | 'mal';
  icono: React.ReactNode;
  titulo: React.ReactNode;
  children?: React.ReactNode;
}) {
  const color = tono === 'mal'
    ? 'bg-red-50 border-red-200 text-red-800'
    : tono === 'aviso'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800';
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${color}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{icono}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{titulo}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ControlesPedido({ orderId, recargar }: { orderId: number; recargar: unknown }) {
  const [c, setC] = useState<Controles | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    controlesDePedido(orderId)
      .then(r => { if (vigente) setC(r); })
      .catch(e => { if (vigente) setError((e as Error).message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [orderId, recargar]);

  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Revisando el pedido…
      </div>
    );
  }
  if (error || !c) return <div className="text-sm text-red-700">{error ?? 'No se pudieron hacer los controles.'}</div>;

  // "Ya es cliente del sistema" se dice la primera vez, que es cuando hay algo
  // que decidir. Después el cliente ya es conocido —en FemWay todos están
  // también en FEMAVI— y repetirlo en cada pedido es ruido que tapa lo que sí
  // importa. Lo que no se calla nunca: que el cliente sea de otro vendedor.
  const otro = c.cliente_de_otro_vendedor;
  const dup = (c.primera_vez || otro || c.pase_femway) ? c.duplicados_sistema : [];
  const web = c.duplicados_web;
  const esFemway = c.pedido?.proyecto === 'femway';

  // De quién es el cliente en el sistema viejo. Se dice siempre: si lo cargó un
  // vendedor y el cliente figura con otro, hay que mirarlo antes de aprobar.
  const deQuien = (d: typeof dup[number]) =>
    d.vendedor_nombre ? `${d.vendedor_nombre} (${d.vendedor})` : d.vendedor ? `vendedor ${d.vendedor}` : 'sin vendedor';

  return (
    <div className="space-y-2">
      {/* CUIT */}
      {c.cuit.estado === 'ok' ? (
        <Fila tono="ok" icono={<CheckCircle2 className="w-4 h-4" />}
          titulo={<>CUIT {c.cuit.formateado} · {c.cuit.tipo}</>}>
          <p className="text-xs opacity-80">Está bien formado y el dígito verificador cierra.</p>
        </Fila>
      ) : (
        <Fila tono={c.cuit.estado === 'falta' ? 'aviso' : 'mal'}
          icono={c.cuit.estado === 'falta' ? <AlertTriangle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          titulo={c.cuit.mensaje ?? 'Revisar el CUIT'}>
          {c.cuit.digitos && <p className="text-xs opacity-80">Lo que vino: {c.cuit.digitos}</p>}
        </Fila>
      )}

      {/* Cliente que ya existe en el sistema viejo */}
      {dup.length > 0 && (
        <Fila
          tono={c.duplicado_grave || otro ? (c.duplicado_grave ? 'mal' : 'aviso') : 'ok'}
          icono={c.duplicado_grave || otro ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          titulo={otro
            // Lo que hay que mirar: el cliente es de otro vendedor.
            ? `Ojo: este cliente figura con ${deQuien(otro)}, no con ${c.pedido.vendedor_nombre ?? 'el vendedor del pedido'}`
            : c.pase_femway
              // Que esté en los dos lados es a propósito: alguien lo pasó a FemWay.
              ? `Pasado a FemWay el ${fecha(c.pase_femway.pasado_el)}: es el mismo cliente en los dos proyectos`
              : c.duplicado_grave
                ? 'Ojo: ya es cliente de FEMAVI y compró en el último año'
                : esFemway && !dup.some(d => d.compro_ultimo_anio)
                  ? 'Ya existe en FEMAVI, pero no compra hace más de un año'
                  : 'Es un cliente que ya está en el sistema'}>
          <ul className="mt-1.5 space-y-1">
            {dup.map(d => (
              <li key={d.codigo} className="text-xs">
                <Link to={`/admin/clientes/${d.codigo}`} className="font-semibold underline">
                  {d.razon_social ?? d.codigo}
                </Link>
                <span className="opacity-80">
                  {' '}· cód. {d.codigo}{d.localidad ? ` · ${d.localidad}` : ''}
                  {' '}· {deQuien(d)}
                  {' '}· última compra {fecha(d.ultima_compra)}
                  {d.compro_ultimo_anio ? ' (en el último año)' : ' (dormido)'}
                  {' '}· mismo CUIT
                </span>
              </li>
            ))}
          </ul>
        </Fila>
      )}

      {/* El mismo pedido cargado dos veces: mismo cliente y mismo importe. Que
          un cliente compre seguido no se avisa, es lo normal. */}
      {web.length > 0 && (
        <Fila tono="aviso" icono={<AlertTriangle className="w-4 h-4" />}
          titulo="Hay otro pedido de este cliente por el mismo importe">
          <ul className="mt-1.5 space-y-1">
            {web.map(p => (
              <li key={p.id} className="text-xs opacity-90">
                Pedido {p.numero ?? p.id} · {NOMBRE_PROYECTO[p.proyecto]} · {fecha(p.fecha)} · {p.company ?? '—'} · {p.estado}
              </li>
            ))}
          </ul>
        </Fila>
      )}

      {/* Ningún cliente del sistema tiene este CUIT. Si el pedido no viene
          marcado como cliente nuevo, algo no cierra: o el CUIT está mal escrito
          o el cliente todavía no se cargó. */}
      {c.duplicados_sistema.length === 0 && (
        !c.cuit.digitos ? (
          /* Sin CUIT no hay con qué buscarlo: decirlo, no dar por hecho que no existe. */
          <Fila tono="aviso" icono={<AlertTriangle className="w-4 h-4" />}
            titulo="Sin CUIT no puedo buscarlo en el sistema">
            <p className="text-xs opacity-80">
              El cliente puede existir igual. Hay que mirarlo a mano antes de aprobar.
            </p>
          </Fila>
        ) : (
          <Fila
            tono={c.pedido.cliente_nuevo ? 'ok' : 'aviso'}
            icono={c.pedido.cliente_nuevo ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            titulo={c.pedido.cliente_nuevo
              ? 'Cliente nuevo: no hay ninguno con este CUIT en el sistema'
              : 'No encontré ningún cliente del sistema con este CUIT'}>
            <p className="text-xs opacity-80">
              {c.pedido.cliente_nuevo
                ? 'Hay que darlo de alta en el sistema viejo antes de facturar.'
                : 'El pedido no viene marcado como cliente nuevo: fijate si el CUIT está bien escrito.'}
              {web.length === 0 && ' Tampoco hay otro pedido web con este CUIT.'}
            </p>
          </Fila>
        )
      )}

      {/* Precios contra la lista */}
      {c.precio.estado === 'sin_lista' ? (
        <p className="text-xs text-slate-400">Precios: {c.precio.mensaje}</p>
      ) : (
        <Fila tono={c.precio.estado === 'alerta' ? 'mal' : 'ok'}
          icono={c.precio.estado === 'alerta' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          titulo={c.precio.estado === 'alerta'
            ? `${c.precio.alertas} precio${(c.precio.alertas ?? 0) > 1 ? 's' : ''} por debajo de lo permitido`
            : 'Precios dentro de lo permitido'}>
          <p className="text-xs opacity-80 mb-1.5">
            Se tolera hasta {c.precio.tolerancia ?? 20}% por debajo del precio más barato de la
            lista {c.precio.vigencia}.
            {c.precio.tolerancia_propia && ' Es el descuento acordado con este cliente.'}
          </p>
          <ul className="space-y-1">
            {(c.precio.renglones ?? []).map((r, i) => (
              <li key={i} className="text-xs">
                <b>{r.producto}</b>
                {r.sin_referencia ? (
                  <span className="opacity-70"> · no lo encontré en la lista, revisalo a mano</span>
                ) : (
                  <span className={r.alerta ? 'font-semibold' : 'opacity-80'}>
                    {' '}· {fmtPesos.format(r.precio)} contra {fmtPesos.format(r.precio_lista ?? 0)}
                    {' '}({r.descuento_pct}% de descuento)
                    {r.producto_lista && r.producto_lista !== r.producto ? ` · en la lista: ${r.producto_lista}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Fila>
      )}
    </div>
  );
}
