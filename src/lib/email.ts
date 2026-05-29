const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/send-quote-notification`;

export interface QuoteProductDetail {
  name: string;
  slug: string;
  presentation: string;
  quantity: number;
}

export interface QuoteEmailData {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  industry?: string | null;
  message?: string | null;
  productNames: string[];
  productDetails?: QuoteProductDetail[];
}

export async function sendQuoteNotification(data: QuoteEmailData): Promise<void> {
  if (!SUPABASE_URL) return;

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Edge function error', res.status, body);
  } else {
    console.log('[email] Notificación enviada OK');
  }
}
