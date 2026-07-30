import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Loader2, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { getArticleById, upsertArticle } from '../../lib/articles';
import { AdminLayout } from '../../components/AdminLayout';
import type { ArticleInput } from '../../types/article';

const EMPTY: ArticleInput = {
  slug: '', title: '', excerpt: '', content: '', cover_image_url: null,
  tags: [], published: false, published_at: null,
};

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-sm text-slate-900 placeholder:text-slate-400";

export default function ArticleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<ArticleInput>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const a = await getArticleById(Number(id));
        if (!a) { setError('Artículo no encontrado.'); return; }
        setForm({ ...a });
      } catch (e: any) {
        setError(e?.message ?? 'Error cargando artículo');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  const set = <K extends keyof ArticleInput>(key: K, value: ArticleInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleTitleChange = (title: string) => {
    setForm(prev => {
      const autoSlug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slugIsAuto = !prev.id && (prev.slug === '' || prev.slug === prev.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      return { ...prev, title, slug: slugIsAuto ? autoSlug : prev.slug };
    });
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      set('tags', [...form.tags, t]);
      setTagInput('');
    }
  };

  const handlePublishToggle = (published: boolean) => {
    set('published', published);
    if (published && !form.published_at) {
      set('published_at', new Date().toISOString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const saved = await upsertArticle(form);
      toast.success(isNew ? `"${saved.title}" creado` : 'Cambios guardados');
      navigate(`/admin/blog/${saved.id}`, { replace: true });
    } catch (e: any) {
      const msg = e?.message ?? 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout crumbs={[{ label: 'Blog', to: '/admin/blog' }, { label: 'Cargando…' }]}>
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      crumbs={[{ label: 'Blog', to: '/admin/blog' }, { label: isNew ? 'Nuevo artículo' : form.title || '…' }]}
      actions={
        <div className="flex items-center gap-2">
          {!isNew && form.published && (
            <a href={`/blog/${form.slug}`} target="_blank" rel="noopener"
              className="px-3 py-2 text-sm text-slate-600 hover:text-femavi-600 inline-flex items-center gap-1.5 transition">
              <Eye className="w-4 h-4" /> Ver en el sitio
            </a>
          )}
          <button
            type="submit"
            form="article-form"
            disabled={saving}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            {isNew ? 'Nuevo artículo' : form.title || 'Editar artículo'}
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            El contenido usa formato Markdown. Los campos con <span className="text-red-500">*</span> son obligatorios.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form id="article-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Básico */}
          <Section title="Información básica">
            <Field label="Título" required>
              <input required type="text" value={form.title} onChange={e => handleTitleChange(e.target.value)} className={inputCls} placeholder="Cómo elegir el desengrasante correcto…" />
            </Field>
            <Field label="Slug" hint="URL del artículo. Se genera automáticamente del título.">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 focus-within:border-femavi-500 focus-within:ring-2 focus-within:ring-femavi-100 transition">
                <span className="text-slate-400 text-sm font-mono">/blog/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => set('slug', e.target.value)}
                  className="flex-1 py-2.5 bg-transparent outline-none text-sm font-mono"
                  placeholder="como-elegir-el-desengrasante"
                />
              </div>
            </Field>
            <Field label="Extracto (excerpt)" required hint="Resumen de 1-2 oraciones. Aparece en la lista del blog y en SEO.">
              <textarea required rows={3} value={form.excerpt} onChange={e => set('excerpt', e.target.value)} className={inputCls} placeholder="Descripción breve del artículo para el listado y buscadores…" />
            </Field>
            <Field label="URL de imagen de portada" hint="Imagen que aparece en la card del listado y arriba del artículo. Opcional.">
              <input type="text" value={form.cover_image_url ?? ''} onChange={e => set('cover_image_url', e.target.value || null)} className={inputCls} placeholder="https://…" />
            </Field>
          </Section>

          {/* Contenido */}
          <Section title="Contenido" desc="Escribí en formato Markdown. ## para títulos, **texto** para negrita, - para listas, | col | col | para tablas.">
            <textarea
              required
              rows={28}
              value={form.content}
              onChange={e => set('content', e.target.value)}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
              placeholder="## Introducción&#10;&#10;Escribí el contenido acá…"
            />
          </Section>

          {/* Tags y visibilidad */}
          <Section title="Tags y visibilidad">
            <Field label="Tags" hint="Entrá un tag y presioná Enter o el botón Agregar.">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="desengrasante, industria, lubricantes…"
                    className={inputCls}
                  />
                  <button type="button" onClick={addTag} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition whitespace-nowrap">
                    Agregar
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {form.tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 bg-femavi-50 text-femavi-700 rounded-full text-xs font-semibold ring-1 ring-femavi-200">
                        {t}
                        <button type="button" onClick={() => set('tags', form.tags.filter(x => x !== t))} className="hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <label className={`flex items-start gap-3 px-4 py-3 border rounded-lg cursor-pointer transition ${form.published ? 'border-femavi-500 bg-femavi-50/50 ring-1 ring-femavi-500/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="checkbox" checked={form.published} onChange={e => handlePublishToggle(e.target.checked)} className="w-4 h-4 mt-0.5 accent-femavi-600 cursor-pointer" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Publicado</div>
                  <div className="text-xs text-slate-500 leading-snug mt-0.5">Si está activado, el artículo es visible en /blog</div>
                </div>
              </label>
              <Field label="Fecha de publicación" hint="Se completa automáticamente al publicar.">
                <input
                  type="datetime-local"
                  value={form.published_at ? form.published_at.slice(0, 16) : ''}
                  onChange={e => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>
        </form>
      </div>
    </AdminLayout>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}
