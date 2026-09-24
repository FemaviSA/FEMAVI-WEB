import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Plus, Trash2, CheckCircle2, Lock, LogOut, Copy } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { createOrder, sendOrderNotification, SesionVencidaError } from '../lib/orders';
import { verifySellerPin, rememberedSeller, forgetSeller, perfilDeVendedor, PaseVencidoError, type Seller } from '../lib/sellers';
import { datosDeCliente, type DatosCliente } from '../lib/historial';
import { SEO, SITE_URL } from '../components/SEO';
import MisVentas from '../components/MisVentas';
import MisClientes from '../components/MisClientes';
import { NOMBRE_PROYECTO, type Proyecto } from '../lib/proyectos';

const C = {
  bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac',
  accentMuted: 'rgba(0,103,172,0.07)', dark: '#003058',
  text: '#1a2b3c', textMuted: '#5a6f80', textLight: '#8899a8',
  borderLight: '#e2e8ee', border: 'rgba(0,103,172,0.15)', ok: '#10b981',
};

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
});

const CONDICIONES_IVA = [
  'Responsable Inscripto', 'Monotributo', 'Exento',
  'Consumidor Final', 'No Responsable',
];

const input: React.CSSProperties = {
  width: '100%', padding: '9px 11px', background: C.white,
  border: `1px solid ${C.borderLight}`, borderRadius: 8,
  color: C.text, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
  outline: 'none', boxSizing: 'border-box',
};



// --- Estilos de la planilla ----------------------------------------------
// Replican el formulario en papel: recuadros, rótulo chico arriba y el dato
// escrito adentro de la celda, sin aspecto de formulario web.

const BORDE = '1px solid #9fb0c0';
const VERDE_BONIF = '#047857';

const celda: React.CSSProperties = {
  borderRight: BORDE, borderBottom: BORDE, padding: '5px 8px', minWidth: 0,
};

const rotulo: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: C.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  display: 'block', marginBottom: 2, whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis',
};

const campo: React.CSSProperties = {
  width: '100%', border: 'none', outline: 'none', background: 'transparent',
  fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: C.text,
  padding: '1px 0', boxSizing: 'border-box', minWidth: 0,
};

const rotuloLateral: React.CSSProperties = {
  ...celda, background: '#eef3f8', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: 10, fontWeight: 800, color: C.dark,
  textAlign: 'center', letterSpacing: '0.05em', lineHeight: 1.2,
};

const thP: React.CSSProperties = {
  borderRight: BORDE, borderBottom: BORDE, background: '#eef3f8',
  padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 800,
  color: C.dark, textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

const tdP: React.CSSProperties = {
  borderRight: BORDE, borderBottom: BORDE, padding: '4px 8px',
  fontSize: 13, verticalAlign: 'middle',
};
/** Una celda de la planilla: rótulo chico arriba, dato adentro. */
function Casilla({ rot, span = 1, children }: { rot?: string; span?: number; children: React.ReactNode }) {
  return (
    <div className="casilla" style={{ ...celda, gridColumn: `span ${span}` }}>
      {rot && <span style={rotulo}>{rot}</span>}
      {children}
    </div>
  );
}




interface Renglon {
  id: number;
  product: string;
  /** Cómo se compone la cantidad: "2x200" son dos envases de 200. */
  presentation: string;
  /** Cantidad total en litros o kilos: la que se multiplica por el precio. */
  quantity: string;
  /** Precio por litro o por kilo, no por envase. */
  unitPrice: string;
  /** true si la cantidad salió del envase y no la tipeó el vendedor. */
  qtyAuto: boolean;
}

type CampoTexto = 'product' | 'presentation' | 'quantity' | 'unitPrice';

const renglonVacio = (id: number): Renglon => ({
  id, product: '', presentation: '', quantity: '', unitPrice: '', qtyAuto: false,
});

// "2x200", "2 x 200", "2X200", "4x2,5". Sin barras invertidas a propósito:
// ya se perdió una al generar este archivo y el campo borraba todos los números.
const RE_ENVASE = /^[ ]*([0-9]+(?:[.,][0-9]+)?)[ ]*[xX×*][ ]*([0-9]+(?:[.,][0-9]+)?)/;

function formatearCantidad(v: number): string {
  const redondeado = Math.round(v * 1000) / 1000;
  return String(redondeado).replace('.', ',');
}

/**
 * Deja escribir el signo menos, pero solo al principio: una cantidad negativa
 * es una bonificación sobre el renglón de arriba, no un número cualquiera.
 */
function limpiarCantidad(valor: string): string {
  const negativo = valor.trimStart().startsWith('-');
  return (negativo ? '-' : '') + valor.replace(/[^0-9.,]/g, '');
}

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
// Formulario de pedido
// ---------------------------------------------------------------------------

export default function SellerOrder() {
  const { code = '' } = useParams();
  const { products } = useProducts();

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

  const [enviado, setEnviado] = useState(false);
  // El número lo asigna la base al guardar, así que recién se conoce acá.
  const [numero, setNumero] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Los 5 renglones iniciales usan los id 0 a 4, así que los que se agregan
  // después arrancan del 5: si repitieran un id, React mezclaría las filas.
  const proximoId = useRef(4);
  // Traba contra el doble clic. No alcanza con el estado `enviando`: se aplica
  // en el siguiente refresco de pantalla, y con internet lento entran dos
  // clics antes de eso. Serían dos pedidos iguales con numeros distintos.
  const enviandoRef = useRef(false);
  // Renglones a medias que marcó el último intento de envío, para pintarlos
  // y que el vendedor no tenga que buscarlos a ojo entre todas las filas.
  const [renglonesMal, setRenglonesMal] = useState<number[]>([]);

  const [f, setF] = useState({
    account: '', sales_cycle: '', purchase_order: '', ship_date: '', is_new_client: false,
    company: '', client_code: '', bill_address: '', bill_city: '',
    phone: '', client_name: '', email: '', tax_condition: '', cuit: '', payment_terms: '',
    delivery_address: '', ship_city: '', ship_phone: '', ship_contact: '',
    carrier: '', zone: '', notes: '',
  });

  const [renglones, setRenglones] = useState<Renglon[]>(
    () => Array.from({ length: 5 }, (_, i) => renglonVacio(i)),
  );

  useEffect(() => {
    document.body.style.background = C.bg;
    return () => { document.body.style.background = ''; };
  }, []);

  const set = (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF(p => ({ ...p, [k]: e.target.value }));

  // --- Autocompletado del cliente -----------------------------------------
  // Se escribe el código y la planilla se llena con lo que ya está cargado en
  // el sistema viejo. La condición de IVA y la de pago quedan a mano: en el
  // sistema viejo son números sin tabla que los explique.
  const [cliente, setCliente] = useState<DatosCliente | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteNoEsta, setClienteNoEsta] = useState(false);
  // El último código que se completó, para no volver a pisar los campos si el
  // vendedor corrigió algo a mano y el código no cambió.
  const ultimoCompletado = useRef('');
  // Lo que se completó solo. Si después se cambia el código y el nuevo no
  // existe, estos campos se vacían: un pedido con el código de un cliente y
  // los datos de otro es peor que un pedido en blanco. Lo que el vendedor
  // haya corregido a mano no se toca, porque ya no coincide con lo completado.
  const completadoPorNosotros = useRef<Partial<typeof f>>({});

  useEffect(() => {
    const codigo = f.client_code.trim();
    const olvidar = () => {
      // La copia es a propósito: React corre el actualizador más tarde, y para
      // entonces la referencia ya está vacía.
      const completado = completadoPorNosotros.current;
      completadoPorNosotros.current = {};
      ultimoCompletado.current = '';
      setF(p => {
        const limpio = { ...p };
        for (const [k, v] of Object.entries(completado)) {
          if (p[k as keyof typeof f] === v) (limpio as Record<string, unknown>)[k] = '';
        }
        return limpio;
      });
      setCliente(null);
    };

    if (!seller || f.is_new_client || codigo.length < 2) {
      if (ultimoCompletado.current) olvidar();
      setClienteNoEsta(false);
      return;
    }
    if (codigo === ultimoCompletado.current) return;

    let vigente = true;
    setBuscandoCliente(true);
    const t = setTimeout(() => {
      datosDeCliente(seller.token, codigo)
        .then(d => {
          if (!vigente) return;
          setClienteNoEsta(d === null);
          if (!d) { olvidar(); return; }
          const completado = {
            company: d.company ?? '', cuit: d.cuit ?? '',
            bill_address: d.bill_address ?? '', bill_city: d.bill_city ?? '',
            phone: d.phone ?? '', client_name: d.client_name ?? '',
            delivery_address: d.delivery_address ?? '', ship_city: d.ship_city ?? '',
            ship_phone: d.ship_phone ?? '', zone: d.zone ?? '',
          };
          setCliente(d);
          ultimoCompletado.current = codigo;
          completadoPorNosotros.current = completado;
          setF(p => ({ ...p, ...completado }));
        })
        .catch(e => { if (vigente && e instanceof PaseVencidoError) paseVencido(); })
        .finally(() => { if (vigente) setBuscandoCliente(false); });
    }, 400);   // se espera a que termine de tipear el código

    return () => { vigente = false; clearTimeout(t); setBuscandoCliente(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.client_code, f.is_new_client, seller]);

  const setRenglon = (id: number, campo: CampoTexto, valor: string) => {
    setRenglonesMal([]);
    setRenglones(rs => {
      const i = rs.findIndex(r => r.id === id);
      if (i < 0) return rs;
      const siguiente = rs.map(r => (r.id === id ? { ...r, [campo]: valor } : r));

      // Envase "2x200" → cantidad 400: la cantidad es el total en litros o
      // kilos y el envase dice cómo se compone. Solo se completa si la
      // cantidad está vacía o la había calculado el envase; lo que el vendedor
      // tipeó a mano no se pisa.
      if (campo === 'presentation') {
        const actual = siguiente[i];
        const m = valor.match(RE_ENVASE);
        if (m && (actual.quantity.trim() === '' || actual.qtyAuto)) {
          siguiente[i] = { ...actual, quantity: formatearCantidad(num(m[1]) * num(m[2])), qtyAuto: true };
        } else if (!m && actual.qtyAuto) {
          siguiente[i] = { ...actual, quantity: '', qtyAuto: false };
        }
      }
      if (campo === 'quantity') siguiente[i] = { ...siguiente[i], qtyAuto: false };

      // Bonificación: una cantidad en negativo descuenta parte de lo que se
      // cargó más arriba, así que el renglón se completa solo con ese mismo
      // producto, envase y precio. Multiplicado por la cantidad negativa, el
      // importe queda en negativo y resta del total.
      if (campo === 'quantity' && valor.trimStart().startsWith('-')) {
        const arriba = [...siguiente.slice(0, i)].reverse().find(r => r.product.trim());
        if (arriba) {
          // El envase queda vacío a propósito: la bonificación descuenta sobre
          // lo de arriba, no es un envase más que salga del depósito.
          siguiente[i] = {
            ...siguiente[i],
            product: siguiente[i].product.trim() || arriba.product,
            unitPrice: siguiente[i].unitPrice.trim() || arriba.unitPrice,
          };
        }
      }
      return siguiente;
    });
  };

  const agregarRenglon = () => {
    proximoId.current += 1;
    setRenglones(rs => [...rs, renglonVacio(proximoId.current)]);
  };

  const quitarRenglon = (id: number) =>
    setRenglones(rs => (rs.length === 1 ? [renglonVacio(id)] : rs.filter(r => r.id !== id)));

  // Presentaciones del producto elegido, para no tener que tipear el envase.
  const presentacionesDe = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const p of products) mapa.set(p.name.toLowerCase(), p.presentations ?? []);
    return mapa;
  }, [products]);

  const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;
  const totalDe = (r: Renglon) => num(r.quantity) * num(r.unitPrice);
  const total = renglones.reduce((acc, r) => acc + totalDe(r), 0);
  const conProducto = renglones.filter(r => r.product.trim());

  const copiarDireccion = () =>
    setF(p => ({
      ...p,
      delivery_address: p.bill_address,
      ship_city: p.bill_city,
      ship_phone: p.phone,
      ship_contact: p.client_name,
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Lo que administración no puede procesar si falta.
    const faltan: string[] = [];
    if (!f.account) faltan.push('la cuenta (C1 o C2)');
    if (!f.company.trim()) faltan.push('la razón social');
    if (!f.bill_city.trim()) faltan.push('la ciudad y provincia');
    if (!f.client_code.trim() && !f.is_new_client) faltan.push('el código de cliente (o tildar que es cliente nuevo)');

    // De un cliente nuevo no hay ficha que consultar ni un "donde siempre" al
    // que despachar, así que el alta tiene que venir completa de una.
    if (f.is_new_client) {
      if (!f.bill_address.trim()) faltan.push('la dirección fiscal');
      if (!f.phone.trim()) faltan.push('el WhatsApp');
      if (!f.email.trim()) faltan.push('el e-mail');
      if (!f.tax_condition) faltan.push('la condición de IVA');
      if (!f.cuit.trim()) faltan.push('el CUIT');
      if (!f.payment_terms.trim()) faltan.push('la condición de pago');
      if (!f.delivery_address.trim()) faltan.push('la dirección de entrega');
      if (!f.ship_city.trim()) faltan.push('la ciudad y provincia de entrega');
    }

    // Un renglón empezado y dejado por la mitad: sin envase o sin precio no se
    // puede facturar, y es más peligroso que un renglón vacío porque pasa
    // desapercibido.
    const aMedias = renglones.filter(r => {
      const algo = r.product.trim() || r.presentation.trim() || r.quantity.trim() || r.unitPrice.trim();
      if (!algo) return false;
      // En una bonificación el envase va vacío, así que ahí no se pide.
      const bonificacion = num(r.quantity) < 0;
      const todo = r.product.trim() && r.quantity.trim() && r.unitPrice.trim()
        && (bonificacion || r.presentation.trim());
      return !todo;
    });
    setRenglonesMal(aMedias.map(r => r.id));
    if (aMedias.length) {
      faltan.push(
        aMedias.length === 1
          ? 'cantidad, envase, producto y precio en el renglón que quedó a medias'
          : `cantidad, envase, producto y precio en ${aMedias.length} renglones que quedaron a medias`,
      );
    }

    if (conProducto.length === 0) faltan.push('al menos un producto');

    // Una bonificación mayor que lo comprado deja el pedido en negativo: sería
    // FEMAVI pagándole al cliente. Casi siempre es un signo de más o una
    // cantidad mal tipeada, así que no lo dejamos salir.
    if (conProducto.length > 0 && total < 0) {
      setError('El total del pedido da negativo. Revisá las cantidades bonificadas: no pueden superar lo que se compra.');
      window.scrollTo(0, 0);
      return;
    }

    if (faltan.length) {
      setError('Falta completar: ' + faltan.join('  ·  '));
      window.scrollTo(0, 0);
      return;
    }

    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      // order_number no se manda: lo asigna la base con un contador atómico,
      // así dos vendedores simultáneos nunca reciben el mismo número.
      const pedido = await createOrder({
        account: f.account,
        sales_cycle: f.sales_cycle,
        purchase_order: f.purchase_order,
        ship_date: f.ship_date || null,
        seller_code: seller?.code ?? code,
        is_new_client: f.is_new_client,

        client_name: f.client_name || f.company,
        client_code: f.client_code,
        company: f.company,
        email: f.email,
        phone: f.phone,
        bill_address: f.bill_address,
        bill_city: f.bill_city,
        tax_condition: f.tax_condition,
        cuit: f.cuit,
        payment_terms: f.payment_terms,

        delivery_address: f.delivery_address,
        ship_phone: f.ship_phone,
        ship_city: f.ship_city,
        ship_contact: f.ship_contact,
        carrier: f.carrier,
        zone: f.zone,

        items: conProducto.map(r => ({
          product: r.product.trim(),
          slug: products.find(p => p.name.toLowerCase() === r.product.trim().toLowerCase())?.slug ?? null,
          presentation: r.presentation.trim(),
          quantity: num(r.quantity),
          unit_price: num(r.unitPrice),
        })),
        total,
        notes: f.notes,
      }, seller?.token);

      // Se espera el mail para que "administración ya lo recibió" sea cierto
      // cuando el vendedor lo lee. Si falla, no rompe: el pedido ya está guardado.
      await sendOrderNotification(pedido.id);

      setNumero(pedido.order_number);
      setEnviado(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      if (err instanceof SesionVencidaError) {
        forgetSeller();
        setSeller(null);
        setAvisoPin(err.message);
        return;
      }
      setError(err?.message ?? 'No se pudo enviar el pedido.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const nuevoPedido = () => {
    setEnviado(false);
    setNumero(null);
    setCliente(null);
    setClienteNoEsta(false);
    ultimoCompletado.current = '';
    completadoPorNosotros.current = {};
    setF(p => ({
      ...p,
      account: '', purchase_order: '', ship_date: '', is_new_client: false,
      company: '', client_code: '', bill_address: '', bill_city: '', phone: '',
      client_name: '', email: '', tax_condition: '', cuit: '', payment_terms: '',
      delivery_address: '', ship_city: '', ship_phone: '', ship_contact: '',
      carrier: '', zone: '', notes: '',
    }));
    setRenglones(Array.from({ length: 5 }, () => renglonVacio(++proximoId.current)));
    window.scrollTo(0, 0);
  };

  const seo = (
    <SEO title="Carga de pedidos — FEMAVI" description="" canonical={`${SITE_URL}/vendedores`} noindex />
  );

  if (!seller) {
    return (
      <>{seo}<PantallaPin code={code} aviso={avisoPin} onOk={s => { setAvisoPin(null); setSeller(s); }} /></>
    );
  }

  if (enviado) {
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
            {numero && (
              <div style={{
                display: 'inline-block', padding: '6px 16px', marginBottom: 14,
                background: C.accentMuted, border: `1px solid ${C.border}`, borderRadius: 100,
                fontSize: 15, fontWeight: 800, color: C.accent, letterSpacing: '0.02em',
              }}>N° {numero}</div>
            )}
            <p style={{ fontSize: 15, color: C.textMuted, margin: '0 0 28px', lineHeight: 1.6 }}>
              Quedó registrado a tu nombre en {NOMBRE_PROYECTO[proyecto]} y administración ya lo recibió.
            </p>
            <button onClick={nuevoPedido} style={{
              padding: '13px 26px', background: C.accent, color: C.white, fontSize: 14,
              fontWeight: 700, borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}>Cargar otro pedido</button>
          </div>
        </main>
      </>
    );
  }


  const hoy = new Date().toLocaleDateString('es-AR');

  // Un cliente nuevo no tiene ficha en el sistema: hay que darlo de alta
  // completo. Si ya existe, esos datos ya están y no se piden de nuevo.
  const obligNuevo = f.is_new_client ? ' *' : '';

  const botonCuenta = (valor: 'C1' | 'C2') => (
    <button
      key={valor} type="button"
      onClick={() => setF(p => ({ ...p, account: p.account === valor ? '' : valor }))}
      style={{
        flex: 1, padding: '4px 0', fontSize: 12, fontWeight: 800,
        fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', borderRadius: 4,
        border: f.account === valor ? `1.5px solid ${C.accent}` : BORDE,
        background: f.account === valor ? C.accent : C.white,
        color: f.account === valor ? C.white : C.textMuted,
      }}
    >{valor}</button>
  );

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
        <form onSubmit={submit} style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px 60px' }}>
          {/* Deja claro en qué proyecto está cargando: sale del código, no se elige. */}
          {proyecto === 'femway' && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 10,
              background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6',
              fontSize: 13, fontWeight: 700,
            }}>
              Estás cargando un pedido de {NOMBRE_PROYECTO.femway}. Para {NOMBRE_PROYECTO.femavi}, salí y entrá con tu otro código.
            </div>
          )}
          {error && (
            <div style={{
              marginBottom: 14, padding: '12px 16px', background: '#fef2f2',
              border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8,
              fontSize: 14, fontWeight: 600,
            }}>{error}</div>
          )}

          <div style={{
            background: C.white, borderTop: BORDE, borderLeft: BORDE,
            boxShadow: '0 6px 20px rgba(0,67,112,0.06)',
          }}>
            {/* ---------- Cabecera ---------- */}
            <div className="planilla" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
              <div style={{ ...celda, gridColumn: 'span 5', display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/logo-femavi.png" alt="FEMAVI" style={{ height: 30, width: 'auto' }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: C.dark, letterSpacing: '0.03em' }}>
                  FEMAVI S.A.
                </span>
              </div>

              <Casilla rot="Cuenta *" span={3}>
                <div style={{ display: 'flex', gap: 6 }}>{botonCuenta('C1')}{botonCuenta('C2')}</div>
              </Casilla>

              <Casilla rot="Pedido N°" span={2}>
                <span style={{ ...campo, display: 'block', color: C.textLight, fontStyle: 'italic' }}>
                  al enviar
                </span>
              </Casilla>

              <Casilla rot="Fecha" span={2}>
                <span style={{ ...campo, display: 'block' }}>{hoy}</span>
              </Casilla>

              <div style={{ ...celda, gridColumn: 'span 5', fontSize: 11, color: C.textMuted, lineHeight: 1.45 }}>
                Ibarrola 7071 — CABA (CP 1408)<br />Cel: +54 9 11 6228 4649 · ventas@femavi.com.ar
              </div>

              <Casilla rot="Ciclo de ventas" span={3}>
                <input style={campo} value={f.sales_cycle} onChange={set('sales_cycle')} placeholder="lo completa administración" />
              </Casilla>

              <Casilla rot="Código del agente" span={2}>
                <span style={{ ...campo, display: 'block', fontWeight: 700 }}>{seller.code}</span>
              </Casilla>

              <Casilla rot="Nombre del agente" span={2}>
                <span style={{ ...campo, display: 'block', fontWeight: 700 }}>{seller.name}</span>
              </Casilla>

              <Casilla rot="N° de cliente *" span={4}>
                <input style={campo} value={f.client_code} onChange={set('client_code')} placeholder="o tildá cliente nuevo" />
                {buscandoCliente && (
                  <span style={{ fontSize: 10, color: C.textLight }}>buscando…</span>
                )}
                {!buscandoCliente && cliente && (
                  <span style={{ fontSize: 10, color: C.ok, fontWeight: 700 }}>
                    ✓ {cliente.company}
                  </span>
                )}
                {!buscandoCliente && clienteNoEsta && (
                  <span style={{ fontSize: 10, color: C.textLight }}>
                    no está entre tus clientes; completá a mano
                  </span>
                )}
              </Casilla>

              <Casilla rot="N° de orden de compra" span={4}>
                <input style={campo} value={f.purchase_order} onChange={set('purchase_order')} />
              </Casilla>

              <Casilla rot="Fecha de envío" span={4}>
                <input type="date" style={campo} value={f.ship_date} onChange={set('ship_date')} />
              </Casilla>
            </div>

            {/* La observación que el cliente tiene cargada en el sistema viejo
                ("BAJA 9/2011", "NO VENDER"). Se muestra y nada más: no entra
                en el pedido, pero conviene leerla antes de cargarlo. */}
            {cliente?.nota && (
              <div style={{
                padding: '7px 12px', background: '#fffbeb', borderBottom: BORDE,
                fontSize: 12, color: '#92400e',
              }}>
                <b>Observación del sistema:</b> {cliente.nota}
              </div>
            )}

            {/* ---------- Facturar a ---------- */}
            <div className="planilla" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
              <div className="rotulo-lateral" style={{ ...rotuloLateral, gridColumn: 'span 2', gridRow: 'span 4' }}>
                FACTURAR A
              </div>

              <Casilla rot="Nombre / Razón social *" span={7}>
                <input style={campo} value={f.company} onChange={set('company')} />
              </Casilla>

              <div style={{ ...celda, gridColumn: 'span 3', display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, color: C.dark, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <input
                    type="checkbox" checked={f.is_new_client}
                    onChange={e => setF(p => ({ ...p, is_new_client: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: C.accent, cursor: 'pointer' }}
                  />
                  Cliente nuevo
                </label>
              </div>

              <Casilla rot={`Dirección fiscal${obligNuevo}`} span={5}>
                <input style={campo} value={f.bill_address} onChange={set('bill_address')} />
              </Casilla>
              <Casilla rot="Ciudad y provincia *" span={3}>
                <input style={campo} value={f.bill_city} onChange={set('bill_city')} />
              </Casilla>
              <Casilla rot={`WhatsApp${obligNuevo}`} span={2}>
                <input style={campo} value={f.phone} onChange={set('phone')} />
              </Casilla>

              <Casilla rot="A cargo de Sr." span={4}>
                <input style={campo} value={f.client_name} onChange={set('client_name')} />
              </Casilla>
              <Casilla rot={`E-mail${obligNuevo}`} span={6}>
                <input type="email" style={campo} value={f.email} onChange={set('email')} />
              </Casilla>

              <Casilla rot={`Condición IVA${obligNuevo}`} span={4}>
                <select style={{ ...campo, cursor: 'pointer' }} value={f.tax_condition} onChange={set('tax_condition')}>
                  <option value="">—</option>
                  {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Casilla>
              <Casilla rot={`CUIT${obligNuevo}`} span={3}>
                <input style={campo} value={f.cuit} onChange={set('cuit')} placeholder="30-12345678-9" />
              </Casilla>
              <Casilla rot={`Cond. de pago${obligNuevo}`} span={3}>
                <input style={campo} value={f.payment_terms} onChange={set('payment_terms')} />
              </Casilla>
            </div>

            {/* ---------- Entregar a ---------- */}
            <div className="planilla" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
              <div className="rotulo-lateral" style={{ ...rotuloLateral, gridColumn: 'span 2', gridRow: 'span 3' }}>
                ENTREGAR A
              </div>

              <Casilla rot={`Dirección${obligNuevo}`} span={7}>
                <input style={campo} value={f.delivery_address} onChange={set('delivery_address')} />
              </Casilla>
              <Casilla rot="WhatsApp" span={3}>
                <input style={campo} value={f.ship_phone} onChange={set('ship_phone')} />
              </Casilla>

              <Casilla rot={`Ciudad y provincia${obligNuevo}`} span={6}>
                <input style={campo} value={f.ship_city} onChange={set('ship_city')} />
              </Casilla>
              <div style={{ ...celda, gridColumn: 'span 4', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button" onClick={copiarDireccion}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
                    background: C.accentMuted, color: C.accent, border: `1px solid ${C.border}`,
                    borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}
                >
                  <Copy style={{ width: 11, height: 11 }} /> Igual a facturación
                </button>
              </div>

              <Casilla rot="A cargo de" span={4}>
                <input style={campo} value={f.ship_contact} onChange={set('ship_contact')} />
              </Casilla>
              <Casilla rot="Transporte" span={4}>
                <input style={campo} value={f.carrier} onChange={set('carrier')} />
              </Casilla>
              <Casilla rot="Zona" span={2}>
                <input style={campo} value={f.zone} onChange={set('zone')} />
              </Casilla>
            </div>

            {/* ---------- Productos ---------- */}
            <datalist id="lista-productos">
              {products.map(p => <option key={p.slug} value={p.name} />)}
            </datalist>

            <div style={{ overflowX: 'auto' }}>
              <table className="tabla-productos" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thP, width: 85 }}>Cantidad *</th>
                    <th style={{ ...thP, width: 115 }}>Envase *</th>
                    <th style={thP}>Descripción de productos *</th>
                    <th style={{ ...thP, width: 115 }}>Precio unitario *</th>
                    <th style={{ ...thP, width: 120, textAlign: 'right' }}>Total</th>
                    <th style={{ ...thP, width: 34, borderRight: BORDE }} />
                  </tr>
                </thead>
                <tbody>
                  {renglones.map(r => {
                    const presentaciones = presentacionesDe.get(r.product.trim().toLowerCase()) ?? [];
                    return (
                      <tr key={r.id} style={
                        renglonesMal.includes(r.id) ? { background: '#fef2f2' }
                          : totalDe(r) < 0 ? { background: '#f0fdf4' }
                          : undefined
                      }>
                        <td style={tdP} data-etiqueta="Cantidad">
                          <input
                            style={campo} inputMode="decimal" value={r.quantity}
                            onChange={e => setRenglon(r.id, 'quantity', limpiarCantidad(e.target.value))}
                          />
                        </td>
                        <td style={tdP} data-etiqueta="Envase">
                          <input
                            style={campo} value={r.presentation}
                            placeholder={num(r.quantity) < 0 ? '' : 'ej: 2x200'}
                            title={presentaciones.length ? 'Envases de este producto: ' + presentaciones.join(', ') : undefined}
                            onChange={e => setRenglon(r.id, 'presentation', e.target.value)}
                          />
                        </td>
                        <td style={tdP} data-etiqueta="Descripción">
                          <input
                            style={campo} list="lista-productos" value={r.product}
                            onChange={e => setRenglon(r.id, 'product', e.target.value)}
                          />
                        </td>
                        <td style={tdP} data-etiqueta="Precio unitario">
                          <input
                            style={campo} inputMode="decimal" value={r.unitPrice}
                            placeholder="$ x litro o kilo"
                            onChange={e => setRenglon(r.id, 'unitPrice', e.target.value.replace(/[^\d.,]/g, ''))}
                          />
                        </td>
                        <td data-etiqueta="Total" style={{
                          ...tdP, textAlign: 'right', fontWeight: 700,
                          color: totalDe(r) < 0 ? VERDE_BONIF : totalDe(r) ? C.dark : C.textLight,
                          whiteSpace: 'nowrap',
                        }}>
                          {totalDe(r) < 0 && (
                            <span style={{
                              display: 'block', fontSize: 8, fontWeight: 800,
                              letterSpacing: '0.06em', color: VERDE_BONIF,
                            }}>BONIFICACIÓN</span>
                          )}
                          {totalDe(r) ? money.format(totalDe(r)) : '—'}
                        </td>
                        <td style={{ ...tdP, borderRight: BORDE, textAlign: 'center' }}>
                          <button
                            type="button" onClick={() => quitarRenglon(r.id)} title="Limpiar renglón"
                            style={{
                              width: 22, height: 22, borderRadius: 4, background: 'transparent',
                              border: 'none', color: C.textLight, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Trash2 style={{ width: 11, height: 11 }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={4} style={{ ...tdP, textAlign: 'right', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.dark, background: '#eef3f8' }}>
                      Total del pedido
                    </td>
                    <td style={{ ...tdP, textAlign: 'right', fontWeight: 800, fontSize: 16, color: C.dark, background: '#eef3f8', whiteSpace: 'nowrap' }}>
                      {money.format(total)}
                    </td>
                    <td style={{ ...tdP, borderRight: BORDE, background: '#eef3f8' }} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ---------- Observaciones ---------- */}
            <div className="planilla" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
              <div className="rotulo-lateral" style={{ ...rotuloLateral, gridColumn: 'span 2' }}>
                OBSERVACIONES
              </div>
              <div style={{ ...celda, gridColumn: 'span 10' }}>
                <textarea
                  style={{ ...campo, minHeight: 54, resize: 'vertical' }}
                  value={f.notes} onChange={set('notes')}
                  placeholder="Horario de entrega, instrucciones especiales, cualquier aclaración…"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button" onClick={agregarRenglon}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: C.white, color: C.accent, border: `1.5px solid ${C.border}`,
                borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <Plus style={{ width: 12, height: 12 }} /> Agregar renglón
            </button>
            <span style={{ fontSize: 11, color: C.textLight }}>* campos obligatorios</span>
          </div>

          <button type="submit" disabled={enviando} style={{
            width: '100%', marginTop: 16, padding: 15,
            background: enviando ? C.textLight : C.accent,
            color: C.white, fontSize: 15, fontWeight: 700, borderRadius: 9,
            border: 'none', cursor: enviando ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {enviando && <Loader2 style={{ width: 16, height: 16 }} className="spin" />}
            {enviando ? 'Enviando…' : `Enviar pedido — ${money.format(total)}`}
          </button>
        </form>
        )}
      </div>

      <style>{`
        @keyframes girar { to { transform: rotate(360deg); } }
        .spin { animation: girar 1s linear infinite; }

        /* Los campos no tienen recuadro propio — el recuadro es el de la
           planilla — así que el foco se marca pintando la celda. */
        .planilla input:focus, .planilla select:focus, .planilla textarea:focus,
        .tabla-productos input:focus { background: #eaf3fb !important; }

        .tabla-productos { min-width: 720px; }

        /* En celular la planilla se desarma en una sola columna y cada producto
           queda como ficha, para no tener que arrastrar la pantalla de costado. */
        @media (max-width: 760px) {
          .planilla { grid-template-columns: 1fr !important; }
          .planilla > * { grid-column: span 1 !important; grid-row: auto !important; }
          .rotulo-lateral {
            justify-content: flex-start !important;
            background: #dde7f2 !important; padding: 7px 8px !important;
          }
        }

        @media (max-width: 720px) {
          .tabla-productos { min-width: 0; }
          .tabla-productos thead { display: none; }
          .tabla-productos,
          .tabla-productos tbody,
          .tabla-productos tr,
          .tabla-productos td { display: block; width: 100%; }
          .tabla-productos tr { border-bottom: ${BORDE}; padding: 8px 10px; }
          .tabla-productos td {
            border: none !important; padding: 0 0 8px !important;
            text-align: left !important;
          }
          .tabla-productos td[data-etiqueta]::before {
            content: attr(data-etiqueta); display: block; font-size: 9px;
            font-weight: 700; color: ${C.textMuted}; text-transform: uppercase;
            letter-spacing: 0.05em; margin-bottom: 2px;
          }
          .tabla-productos td[data-etiqueta="Total"] { text-align: right !important; }
          .tabla-productos td[colspan] { text-align: right !important; }
        }
      `}</style>
    </>
  );
}
