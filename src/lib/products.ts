import { supabase } from './supabase';
import type { Product, ProductInput } from '../types/product';
import { SEED_PRODUCTS } from './seed';

const TABLE = 'products';
const BUCKET = 'product-images';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listProducts(opts?: { includeInactive?: boolean }): Promise<Product[]> {
  let q = supabase.from(TABLE).select('*').order('display_order', { ascending: true });
  if (!opts?.includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) {
    console.warn('[products] listProducts fallback to seed:', error.message);
    return opts?.includeInactive ? SEED_PRODUCTS : SEED_PRODUCTS.filter(p => p.is_active);
  }
  return data ?? [];
}

export async function getProductById(id: number): Promise<Product | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    console.warn('[products] getProductBySlug error:', error.message);
    return SEED_PRODUCTS.find(p => p.slug === slug && p.is_active) ?? null;
  }
  return data;
}

export async function upsertProduct(input: ProductInput): Promise<Product> {
  const payload = {
    ...input,
    slug: input.slug || slugify(input.name),
  };
  const { data, error } = await supabase.from(TABLE).upsert(payload).select().single();
  if (error) throw error;
  return data as Product;
}

export async function softDeleteProduct(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function restoreProduct(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_active: true }).eq('id', id);
  if (error) throw error;
}

export async function uploadProductImage(file: File, productSlug: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${productSlug}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
