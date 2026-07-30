import { supabase } from './supabase';

export interface OrderItem {
  product: string;
  presentation: string;
  quantity: number;
}

export interface OrderInput {
  client_name: string;
  client_code?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  items: OrderItem[];
  delivery_address?: string | null;
  notes?: string | null;
}

export async function createOrder(input: OrderInput): Promise<void> {
  const { error } = await supabase.from('orders').insert({
    client_name: input.client_name.trim(),
    client_code: input.client_code?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    company: input.company?.trim() || null,
    items: input.items.filter(i => i.product.trim()),
    delivery_address: input.delivery_address?.trim() || null,
    notes: input.notes?.trim() || null,
  });

  if (error) {
    console.warn('[orders] insert error:', error.message);
    throw new Error('No se pudo enviar el pedido. Intentá de nuevo o contactanos por WhatsApp.');
  }
}
