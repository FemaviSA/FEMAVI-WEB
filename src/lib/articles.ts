import { supabase } from './supabase';
import type { Article, ArticleInput } from '../types/article';

const TABLE = 'articles';

export async function listArticles(opts?: { includeUnpublished?: boolean }): Promise<Article[]> {
  let q = supabase.from(TABLE).select('*').order('published_at', { ascending: false });
  if (!opts?.includeUnpublished) q = q.eq('published', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getArticleById(id: number): Promise<Article | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertArticle(input: ArticleInput): Promise<Article> {
  const payload = {
    ...input,
    published_at: input.published && !input.published_at ? new Date().toISOString() : input.published_at,
  };
  const { data, error } = await supabase.from(TABLE).upsert(payload).select().single();
  if (error) throw error;
  return data as Article;
}

export async function deleteArticle(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
