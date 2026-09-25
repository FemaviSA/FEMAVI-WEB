import { supabase } from './supabase';

export interface OrderItem {
  product: string;
  slug?: string | null;
  presentation: string;
  quantity: number;
  /** Lo escribe el vendedor a mano; no sale de ninguna lista de precios. */
  unit_price?: number | null;
  /** cantidad × precio unitario, igual que la columna I de la planilla en papel. */
  line_total?: number | null;
}

export interface OrderInput {
  // Cabecera
  /** C1 o C2: la cuenta a la que va el pedido. */
  account?: string | null;
  sales_cycle?: string | null;
  purchase_order?: string | null;
  ship_date?: string | null;
  seller_code?: string | null;
  is_new_client?: boolean;

  // Facturar a
  client_name: string;
  client_code?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  bill_address?: string | null;
  bill_city?: string | null;
  tax_condition?: string | null;
  cuit?: string | null;
  payment_terms?: string | null;

  // Entregar a
  delivery_address?: string | null;
  ship_phone?: string | null;
  ship_city?: string | null;
  ship_contact?: string | null;
  carrier?: string | null;
  zone?: string | null;

  // Cuerpo
  items: OrderItem[];
  total?: number | null;
  notes?: string | null;
}

const txt = (v?: string | null) => v?.trim() || null;

export interface OrderCreated {
  id: number;
  order_number: string | null;
}

/** El pase del vendedor venció o se cerró: hay que volver a pedir el PIN. */
export class SesionVencidaError extends Error {
  constructor() {
    super('Tu sesión venció. Volvé a ingresar tu PIN y el pedido sigue cargado.');
    this.name = 'SesionVencidaError';
  }
}

/**
 * `sellerToken` es el pase del vendedor. La base saca de ahí a quién
 * pertenece el pedido; sin pase, el pedido queda sin vendedor (formulario de
 * clientes).
 */
export async function createOrder(input: OrderInput, sellerToken?: string): Promise<OrderCreated> {
  const items = input.items.filter(i => i.product.trim());

  // El total se recalcula acá y no se confía en el que venga del formulario:
  // es el número que después se factura.
  const total = items.reduce(
    (acc, i) => acc + (i.quantity || 0) * (i.unit_price || 0),
    0,
  );

  // Se guarda con una función de la base y no con un insert directo: el
  // formulario necesita el número que le toca al pedido, pero un visitante
  // anónimo no puede — ni debe — leer la tabla de pedidos. La función inserta
  // y devuelve sólo el id y el número, sin abrir nada más.
  const { data, error } = await supabase.rpc('create_order', {
    p: {
    account: txt(input.account),
    sales_cycle: txt(input.sales_cycle),
    purchase_order: txt(input.purchase_order),
    ship_date: txt(input.ship_date),
    is_new_client: input.is_new_client ?? false,

    client_name: input.client_name.trim(),
    client_code: txt(input.client_code),
    company: txt(input.company),
    email: input.email?.trim().toLowerCase() || null,
    phone: txt(input.phone),
    bill_address: txt(input.bill_address),
    bill_city: txt(input.bill_city),
    tax_condition: txt(input.tax_condition),
    cuit: txt(input.cuit),
    payment_terms: txt(input.payment_terms),

    delivery_address: txt(input.delivery_address),
    ship_phone: txt(input.ship_phone),
    ship_city: txt(input.ship_city),
    ship_contact: txt(input.ship_contact),
    carrier: txt(input.carrier),
    zone: txt(input.zone),

    items: items.map(i => ({
      ...i,
      line_total: (i.quantity || 0) * (i.unit_price || 0),
    })),
    total,
    notes: txt(input.notes),
    },
    p_token: sellerToken ?? null,
  });

  if (error?.message?.includes('sesion_vencida')) throw new SesionVencidaError();

  // Un cliente de FemWay es de un solo vendedor: la base no deja cargarle un
  // pedido a un cliente de otro.
  if (error?.message?.includes('cliente_de_otro_vendedor')) {
    throw new Error('Ese CUIT ya es de otro vendedor de FemWay. Hablá con administración.');
  }

  if (error || !data) {
    console.warn('[orders] insert error:', error?.message);
    throw new Error('No se pudo enviar el pedido. Intentá de nuevo o contactanos por WhatsApp.');
  }

  return data as OrderCreated;
}

/**
 * Pide el mail del pedido. Se manda solo el id: la función lo lee de la base y
 * arma el mail con lo que quedó guardado, así lo que recibe administración no
 * puede diferir de lo que después ve en el panel.
 *
 * No corta el envío si falla: el pedido ya está guardado, y hacer que el
 * vendedor lo cargue de nuevo por un mail caído sería peor.
 */
export async function sendOrderNotification(orderId: number): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!url) return;

  try {
    const res = await fetch(url + '/functions/v1/send-order-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
      body: JSON.stringify({ order_id: orderId }),
    });
    if (!res.ok) console.warn('[orders] no se pudo mandar el mail:', res.status, await res.text());
  } catch (e) {
    console.warn('[orders] no se pudo mandar el mail:', e);
  }
}
