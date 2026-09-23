import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { controlesDePedido, type ControlesPedido as Controles } from '../lib/adminOrders';
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

  const dup = c.duplicados_sistema;
  const web = c.duplicados_web;

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

      {/* Cliente que ya existe en el sistema */}
      {dup.length > 0 && (
        <Fila tono={c.duplicado_grave ? 'mal' : 'aviso'} icono={<AlertTriangle className="w-4 h-4" />}
          titulo={c.duplicado_grave
            ? `Ojo: ya es cliente de FEMAVI y compró en el último año`
            : 'Ya existe en el sistema, pero no compra hace más de un año'}>
          <ul className="mt-1.5 space-y-1">
            {dup.map(d => (
              <li key={d.codigo} className="text-xs">
                <Link to={`/admin/clientes/${d.codigo}`} className="font-semibold underline">
                  {d.razon_social ?? d.codigo}
                </Link>
                <span className="opacity-80">
                  {' '}· cód. {d.codigo}{d.localidad ? ` · ${d.localidad}` : ''}
                  {' '}· última compra {fecha(d.ultima_compra)}
                  {d.compro_ultimo_anio ? ' (en el último año)' : ' (dormido)'}
                  {' '}· {d.coincide_por === 'cuit' ? 'mismo CUIT' : `nombre parecido (${Math.round((d.parecido ?? 0) * 100)}%)`}
                </span>
              </li>
            ))}
          </ul>
        </Fila>
      )}

      {/* Mismo cliente en otro pedido de la web */}
      {web.length > 0 && (
        <Fila tono="aviso" icono={<AlertTriangle className="w-4 h-4" />}
          titulo="Ya hay otro pedido web de este mismo cliente">
          <ul className="mt-1.5 space-y-1">
            {web.map(p => (
              <li key={p.id} className="text-xs opacity-90">
                Pedido {p.numero ?? p.id} · {NOMBRE_PROYECTO[p.proyecto]} · {fecha(p.fecha)} · {p.company ?? '—'} · {p.estado}
              </li>
            ))}
          </ul>
        </Fila>
      )}

      {dup.length === 0 && web.length === 0 && (
        <Fila tono="ok" icono={<CheckCircle2 className="w-4 h-4" />} titulo="No aparece repetido">
          <p className="text-xs opacity-80">No coincide con ningún cliente del sistema ni con otro pedido web.</p>
        </Fila>
      )}

      <p className="text-xs text-slate-400">
        Precio contra lista: {c.precio.mensaje}
      </p>
    </div>
  );
}
