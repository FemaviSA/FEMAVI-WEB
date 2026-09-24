import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Lock, LogOut } from 'lucide-react';
import { createOrder, SesionVencidaError } from '../lib/orders';
import { verifySellerPin, rememberedSeller, forgetSeller, perfilDeVendedor, PaseVencidoError, type Seller } from '../lib/sellers';
import { buscarMiCliente, datosDeCliente } from '../lib/historial';
import { SEO, SITE_URL } from '../components/SEO';
import MisVentas from '../components/MisVentas';
import MisClientes from '../components/MisClientes';
import { NOMBRE_PROYECTO, type Proyecto } from '../lib/proyectos';
import PlanillaPedido, { C, Casilla, campo, type FuentesDeCliente } from '../components/PlanillaPedido';

const input: React.CSSProperties = {
  width: '100%', padding: '9px 11px', background: C.white,
  border: `1px solid ${C.borderLight}`, borderRadius: 8,
  color: C.text, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
  outline: 'none', boxSizing: 'border-box',
};

// ---------------------------------------------------------------------------
// Pantalla de PIN
// ---------------------------------------------------------------------------

function PantallaPin({ code, aviso, onOk }: { code: string; aviso?: string | null; onOk: (s: Seller) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await verifySellerPin(code, pin);
      if (r.ok) { onOk(r.seller); return; }
      if (r.reason === 'locked') {
        const hasta = new Date(r.until).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        setError(`Demasiados intentos. Probá de nuevo a partir de las ${hasta}.`);
      } else {
        setError('Código o PIN incorrecto.');
      }
      setPin('');
    } catch (err: any) {
      setError(err?.message ?? 'No pudimos validar el PIN.');
    } finally {
      setEnviando(false);
    }
  };

  const bloqueado = enviando || pin.length < 4;

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
    }}>
      <form onSubmit={submit} style={{
        width: '100%', maxWidth: 380, background: C.white, padding: 36,
        borderRadius: 18, border: `1px solid ${C.borderLight}`,
        boxShadow: '0 12px 36px rgba(0,67,112,0.07)', textAlign: 'center',
      }}>
        <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 38, marginBottom: 24 }} />

        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: C.accentMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Lock style={{ width: 22, height: 22, color: C.accent }} />
        </div>

        <h1 style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 21, fontWeight: 800,
          color: C.dark, margin: '0 0 4px',
        }}>Vendedor {code}</h1>
        <p style={{ fontSize: 14, color: C.textMuted, margin: '0 0 24px' }}>
          Ingresá tu PIN para cargar pedidos.
        </p>

        {aviso && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', background: '#fffbeb',
            border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, fontSize: 13,
          }}>{aviso}</div>
        )}

        <input
          autoFocus required value={pin} type="password" inputMode="numeric"
          autoComplete="one-time-code" placeholder="••••••"
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          style={{
            ...input, textAlign: 'center', fontSize: 26, letterSpacing: '0.35em',
            padding: '14px 11px', fontWeight: 700,
          }}
        />

        {error && (
          <div style={{
            marginTop: 14, padding: '10px 14px', background: '#fef2f2',
            border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, fontSize: 13,
          }}>{error}</div>
        )}

        <button type="submit" disabled={bloqueado} style={{
          width: '100%', marginTop: 18, padding: 14,
          background: bloqueado ? C.textLight : C.accent,
          color: C.white, fontSize: 15, fontWeight: 700, borderRadius: 9,
          border: 'none', cursor: bloqueado ? 'not-allowed' : 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {enviando && <Loader2 style={{ width: 15, height: 15 }} className="spin" />}
          {enviando ? 'Verificando…' : 'Entrar'}
        </button>

        <p style={{ fontSize: 12, color: C.textLight, marginTop: 16, marginBottom: 0 }}>
          Si no lo recordás, pedíselo a administración.
        </p>
      </form>

      <style>{`
        @keyframes girar { to { transform: rotate(360deg); } }
        .spin { animation: girar 1s linear infinite; }
      `}</style>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Carga de pedidos del vendedor
// ---------------------------------------------------------------------------

export default function SellerOrder() {
  const { code = '' } = useParams();

  const [seller, setSeller] = useState<Seller | null>(() => rememberedSeller(code));
  // Si el pase vence a mitad de un pedido, se vuelve al PIN con este aviso. El
  // formulario sigue montado detrás, así que lo cargado no se pierde.
  const [avisoPin, setAvisoPin] = useState<string | null>(null);
  const [vista, setVista] = useState<'pedido' | 'ventas' | 'clientes'>('pedido');
  // El proyecto sale del código con el que entró: cada vendedor tiene uno para
  // FEMAVI y otro para FemWay, así no hay nada que elegir ni que equivocar.
  const proyecto: Proyecto = seller?.proyecto ?? 'femavi';
  const paseVencido = useCallback(() => {
    forgetSeller();
    setSeller(null);
    setAvisoPin('Tu sesión venció. Volvé a ingresar tu PIN.');
  }, []);
  useEffect(() => {
    if (!seller) return;
    let vigente = true;
    perfilDeVendedor(seller.token)
      .then(perfil => {
        if (vigente && perfil && perfil.proyecto !== seller.proyecto) {
          setSeller({ ...seller, proyecto: perfil.proyecto });
        }
      })
      .catch(() => { /* si falla, sigue con lo que tenía guardado */ });
    return () => { vigente = false; };
  }, [seller]);

  useEffect(() => {
    document.body.style.background = C.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  // El número lo asigna la base al guardar, así que recién se conoce acá.
  const [numero, setNumero] = useState<string | null>(null);
  // Cambiarlo desmonta y vuelve a montar la planilla: es la forma más segura
  // de dejarla en blanco para el pedido siguiente.
  const [intento, setIntento] = useState(0);

  const token = seller?.token;
  // Memorizado a propósito: la planilla lo tiene como dependencia de sus
  // efectos, y un objeto nuevo en cada dibujo la haría buscar sin parar.
  const fuentesCliente = useMemo<FuentesDeCliente | undefined>(
    () => (token
      ? { datos: (codigo) => datosDeCliente(token, codigo), buscar: (q) => buscarMiCliente(token, q) }
      : undefined),
    [token],
  );

  const alFallar = useCallback((e: unknown) => {
    if (e instanceof SesionVencidaError) {
      forgetSeller();
      setSeller(null);
      setAvisoPin(e.message);
      return true;
    }
    if (e instanceof PaseVencidoError) { paseVencido(); return true; }
    return false;
  }, [paseVencido]);

  const seo = (
    <SEO title="Carga de pedidos — FEMAVI" description="" canonical={`${SITE_URL}/vendedores`} noindex />
  );

  if (!seller) {
    return (
      <>{seo}<PantallaPin code={code} aviso={avisoPin} onOk={s => { setAvisoPin(null); setSeller(s); }} /></>
    );
  }

  if (numero !== null) {
    return (
      <>
        {seo}
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{
            maxWidth: 460, textAlign: 'center', background: C.white, padding: 44,
            borderRadius: 18, border: `1px solid ${C.borderLight}`,
          }}>
            <div style={{
              width: 62, height: 62, borderRadius: '50%', background: 'rgba(16,185,129,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <CheckCircle2 style={{ width: 30, height: 30, color: C.ok }} />
            </div>
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 26, fontWeight: 800, color: C.dark, margin: '0 0 8px' }}>
              Pedido enviado
            </h1>
            <div style={{
              display: 'inline-block', padding: '6px 16px', marginBottom: 14,
              background: C.accentMuted, border: `1px solid ${C.border}`, borderRadius: 100,
              fontSize: 15, fontWeight: 800, color: C.accent, letterSpacing: '0.02em',
            }}>N° {numero}</div>
            <p style={{ fontSize: 15, color: C.textMuted, margin: '0 0 28px', lineHeight: 1.6 }}>
              Quedó registrado a tu nombre en {NOMBRE_PROYECTO[proyecto]} y administración ya lo recibió.
            </p>
            <button
              onClick={() => { setNumero(null); setIntento(n => n + 1); window.scrollTo(0, 0); }}
              style={{
                padding: '13px 26px', background: C.accent, color: C.white, fontSize: 14,
                fontWeight: 700, borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >Cargar otro pedido</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {seo}
      <div style={{ minHeight: '100vh' }}>
        <header style={{
          background: C.white, borderBottom: `1px solid ${C.borderLight}`,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <div style={{
            maxWidth: 1000, margin: '0 auto', padding: '10px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 8, padding: 3 }}>
              {([['pedido', 'Nuevo pedido'], ['ventas', 'Mis ventas'],
                ...(seller.proyecto === 'femavi' ? [['clientes', 'Mis clientes'] as const] : [])] as const).map(([k, r]) => (
                <button key={k} type="button" onClick={() => setVista(k)} style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                  background: vista === k ? C.white : 'transparent',
                  color: vista === k ? C.dark : C.textMuted,
                  boxShadow: vista === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>{r}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{seller.name}</div>
                <div style={{ fontSize: 10, color: C.textLight }}>
                  Agente {seller.code} ·{' '}
                  <span style={{
                    fontWeight: 800,
                    color: seller.proyecto === 'femway' ? '#7c3aed' : '#0067ac',
                  }}>{NOMBRE_PROYECTO[seller.proyecto]}</span>
                </div>
              </div>
              <button
                type="button" title="Salir"
                onClick={() => { forgetSeller(seller.token); setSeller(null); }}
                style={{
                  width: 32, height: 32, borderRadius: 7, background: C.bg,
                  border: `1px solid ${C.borderLight}`, color: C.textMuted, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </header>

        {vista === 'ventas' ? (
          <MisVentas token={seller.token} proyecto={seller.proyecto} onPaseVencido={paseVencido} />
        ) : vista === 'clientes' ? (
          <MisClientes token={seller.token} vendedor={seller} onPaseVencido={paseVencido} />
        ) : (
          <PlanillaPedido
            key={intento}
            casillasAgente={
              <>
                <Casilla rot="Código del agente" span={2}>
                  <span style={{ ...campo, display: 'block', fontWeight: 700 }}>{seller.code}</span>
                </Casilla>
                <Casilla rot="Nombre del agente" span={2}>
                  <span style={{ ...campo, display: 'block', fontWeight: 700 }}>{seller.name}</span>
                </Casilla>
              </>
            }
            cliente={fuentesCliente}
            guardar={(input) => createOrder(input, seller.token)}
            alGuardar={(pedido) => { setNumero(pedido.order_number ?? ''); window.scrollTo(0, 0); }}
            alFallar={alFallar}
            aviso={proyecto === 'femway' ? (
              /* Deja claro en qué proyecto está cargando: sale del código, no se elige. */
              <div style={{
                marginBottom: 14, padding: '10px 14px', borderRadius: 10,
                background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6',
                fontSize: 13, fontWeight: 700,
              }}>
                Estás cargando un pedido de {NOMBRE_PROYECTO.femway}. Para {NOMBRE_PROYECTO.femavi}, salí y entrá con tu otro código.
              </div>
            ) : null}
          />
        )}
      </div>
    </>
  );
}
