import { supabase } from './supabase';
import { track } from './analytics';
import type { QuoteRequest, QuoteRequestInput, QuoteStatus } from '../types/product';

const TABLE = 'quote_requests';

export async function createQuote(input: QuoteRequestInput): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .insert({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      industry: input.industry?.trim() || null,
      message: input.message?.trim() || null,
      product_slugs: input.product_slugs,
      product_details: input.product_details ?? null,
    });

  if (error) throw error;

  // Punto único por donde pasan todas las cotizaciones del sitio (Home y /cotizar),
  // así que es el mejor lugar para medir la conversión. Solo se dispara si la
  // cotización se guardó bien: no queremos contar intentos fallidos como conversión.
  // No mandamos nombre, email ni teléfono a Analytics — solo datos agregados.
  track('quote_submitted', {
    product_count: input.product_slugs.length,
    products: input.product_slugs.slice(0, 10).join(','),
    industry: input.industry?.trim() || 'sin_especificar',
  });
}

export async function listQuotes(opts?: { status?: QuoteStatus | 'all'; includeDeleted?: boolean }): Promise<QuoteRequest[]> {
  let q = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (opts?.status && opts.status !== 'all') q = q.eq('status', opts.status);
  if (!opts?.includeDeleted) q = q.is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listDeletedQuotes(): Promise<QuoteRequest[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getQuoteById(id: number): Promise<QuoteRequest | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateQuoteStatus(id: number, status: QuoteStatus, notes?: string): Promise<void> {
  const payload: Partial<QuoteRequest> = { status };
  if (notes !== undefined) payload.notes = notes;
  const { error } = await supabase.from(TABLE).update(payload).eq('id', id);
  if (error) throw error;
}

/** Soft delete — el registro queda en la DB con deleted_at seteado. Es reversible. */
export async function softDeleteQuote(id: number): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Restaura una cotización soft-deleted. */
export async function restoreQuote(id: number): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
}

export async function getQuoteCounts(): Promise<{ new: number; contacted: number; closed: number; deleted: number; total: number }> {
  const { data, error } = await supabase.from(TABLE).select('status, deleted_at');
  if (error) throw error;
  const counts = { new: 0, contacted: 0, closed: 0, deleted: 0, total: 0 };
  for (const row of data ?? []) {
    if (row.deleted_at) {
      counts.deleted++;
      continue;
    }
    counts.total++;
    if (row.status === 'new') counts.new++;
    else if (row.status === 'contacted') counts.contacted++;
    else if (row.status === 'closed') counts.closed++;
  }
  return counts;
}
