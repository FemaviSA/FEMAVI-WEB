import { useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';
import { consultarArca, FaltaCertificadoError, type PersonaArca } from '../lib/arca';
import { buscarClientes, type ClienteLista } from '../lib/historial';

// Cuadro para preguntarle a ARCA por un CUIT sin salir del admin.
// Si en vez del CUIT se escribe un nombre, primero se busca en nuestra base de
// clientes (ARCA solo responde por CUIT) y se elige de ahí.

const soloDigitos = (s: string) => s.replace(/\D/g, '');

function Dato({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (!valor) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{rotulo}</div>
      <div className="text-sm text-slate-800">{valor}</div>
    </div>
  );
}

export default function ConsultaArca({ cuitInicial, orderId, razonPedido }: {
  cuitInicial?: string | null;
  orderId?: number;
  /** Para comparar lo que dice ARCA con lo que escribió el vendedor. */
  razonPedido?: string | null;
}) {
  const [texto, setTexto] = useState(cuitInicial ?? '');
  const [datos, setDatos] = useState<PersonaArca | null>(null);
  const [candidatos, setCandidatos] = useState<ClienteLista[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faltaCert, setFaltaCert] = useState(false);

  const consultar = async (valor: string) => {
    const digitos = soloDigitos(valor);
    setError(null);
    setFaltaCert(false);
    setCandidatos(null);

    // Escribió un nombre: ARCA no busca por nombre, así que se busca acá.
    if (digitos.length !== 11) {
      if (valor.trim().length < 3) { setError('Escribí un CUIT de 11 dígitos o parte del nombre del cliente.'); return; }
      setCargando(true);
      try {
        const r = await buscarClientes({ q: valor.trim(), orden: 'nombre' });
        setCandidatos(r.slice(0, 8));
        if (r.length === 0) setError('No encontré ese nombre entre nuestros clientes. Probá con el CUIT.');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setCargando(false);
      }
      return;
    }

    setCargando(true);
    setDatos(null);
    try {
      setDatos(await consultarArca(digitos, orderId));
    } catch (e) {
      if (e instanceof FaltaCertificadoError) setFaltaCert(true);
      else setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  const coincideNombre = datos && razonPedido
    ? datos.razon_social?.toLowerCase().replace(/[^a-z0-9]/g, '') ===
      razonPedido.toLowerCase().replace(/[^a-z0-9]/g, '')
    : null;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
        <Building2 className="w-4 h-4" /> Consultar en ARCA
      </h3>

      <div className="flex gap-2">
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') consultar(texto); }}
          placeholder="CUIT o nombre del cliente"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button onClick={() => consultar(texto)} disabled={cargando}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50">
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Consultar
        </button>
      </div>

      {faltaCert && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900">
          <strong>Falta el certificado de ARCA.</strong> Una vez que lo cargues en Supabase, esto funciona solo.
        </div>
      )}
      {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>}

      {/* El nombre puede ser de varios clientes: se elige cuál consultar. */}
      {candidatos && candidatos.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {candidatos.map(c => (
            <li key={c.codigo}>
              <button onClick={() => { setTexto(c.cuit ?? ''); consultar(c.cuit ?? ''); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                <span className="font-semibold text-slate-800">{c.razon_social}</span>
                <span className="block text-xs text-slate-400">Cód. {c.codigo} · CUIT {c.cuit ?? '—'}{c.localidad ? ` · ${c.localidad}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {datos && (
        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900">{datos.razon_social ?? '—'}</span>
            {datos.estado && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${
                datos.estado.toUpperCase().includes('ACTIVO')
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-red-50 text-red-700 ring-red-200'}`}>
                {datos.estado}
              </span>
            )}
          </div>

          {coincideNombre === false && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              En el pedido figura <strong>{razonPedido}</strong>, que no es igual a lo que devuelve ARCA. Puede ser
              el nombre de fantasía, o un CUIT equivocado.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Dato rotulo="CUIT" valor={datos.cuit} />
            <Dato rotulo="Condición" valor={datos.condicion} />
            <Dato rotulo="Tipo" valor={datos.tipo_persona} />
            <Dato rotulo="Domicilio fiscal" valor={[datos.domicilio, datos.codigo_postal].filter(Boolean).join(' · ')} />
          </div>

          {datos.impuestos.length > 0 && (
            <Dato rotulo="Impuestos" valor={<span className="text-xs">{datos.impuestos.join(' · ')}</span>} />
          )}
          {datos.actividades.length > 0 && (
            <Dato rotulo="Actividad" valor={<span className="text-xs">{datos.actividades.slice(0, 3).join(' · ')}</span>} />
          )}
          <p className="text-[11px] text-slate-400">Datos de ARCA en este momento. Queda registrado quién consultó y cuándo.</p>
        </div>
      )}
    </div>
  );
}
