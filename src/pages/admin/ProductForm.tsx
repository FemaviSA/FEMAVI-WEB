import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, X, Save, Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getProductById, upsertProduct, uploadProductImage } from '../../lib/products';
import type { ProductInput } from '../../types/product';
import { AdminLayout } from '../../components/AdminLayout';

const EMPTY: ProductInput = {
  slug: '', name: '', category: '', subcategory: '', headline: '', description: '', story: '',
  industries: [], benefits: [], presentations: [], tags: [],
  dilution: '', ph: '', image_url: '',
  featured: false, display_order: 0, is_active: true,
};

const CATEGORY_OPTIONS = [
  'Higiene Industrial',
  'Producción',
  'Aceites y Lubricantes',
  'Grasas',
  'Aerosoles',
  'Tratamiento de Agua',
  'Papel',
  'Línea Daurange',
];

const SUBCATEGORY_OPTIONS = [
  'Aceites y Aditivos',
  'Aerosoles',
  'Anticorrosivos',
  'Ceras',
  'Desengrasantes',
  'Desinfectantes',
  'Desmoldantes',
  'Detergentes',
  'Grasas',
  'Higiene Industrial',
  'Insecticida',
  'Lavamanos',
  'Limpiadores',
  'Línea Automotor',
  'Lubricantes',
  'Tratamiento para Aguas',
];

const INDUSTRY_OPTIONS = [
  'Transporte', 'Gastronomía', 'Edificios', 'Industria',
  'Automotor', 'Comercios', 'Salud', 'Empresas de limpieza', 'Hogar e Institucional',
];
const BENEFIT_OPTIONS = ['Alto rendimiento', 'Biodegradable', 'Alta concentración', 'Apto alimenticio', 'Larga duración', 'Seguridad industrial', 'Multiuso', 'Ultra concentrado', 'Económico por rendimiento'];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<ProductInput>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const p = await getProductById(Number(id));
        if (!p) {
          setError('Producto no encontrado.');
          return;
        }
        setForm({ ...p });
      } catch (e: any) {
        setError(e?.message ?? 'Error cargando producto');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (name: string) => {
    setForm(prev => {
      const autoSlug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slugIsAuto = !prev.id && (prev.slug === '' || prev.slug === prev.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      return { ...prev, name, slug: slugIsAuto ? autoSlug : prev.slug };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const saved = await upsertProduct(form);
      toast.success(isNew ? `"${saved.name}" creado correctamente` : 'Cambios guardados');
      navigate(`/admin/products/${saved.id}`, { replace: true });
    } catch (e: any) {
      const msg = e?.message ?? 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const url = await uploadProductImage(file, slug || `product-${Date.now()}`);
      set('image_url', url);
      toast.success('Imagen subida');
    } catch (err: any) {
      toast.error(`Error subiendo imagen: ${err?.message ?? 'desconocido'}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <AdminLayout crumbs={[{ label: 'Productos', to: '/admin' }, { label: 'Cargando…' }]}>
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando producto…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      crumbs={[
        { label: 'Productos', to: '/admin' },
        { label: isNew ? 'Nuevo producto' : form.name || '...' },
      ]}
      actions={
        <button
          type="submit"
          form="product-form"
          disabled={saving}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      }
    >
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            {isNew ? 'Nuevo producto' : form.name || 'Editar producto'}
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Los campos con <span className="text-red-500 font-semibold">*</span> son obligatorios. El slug se genera automáticamente del nombre.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
          <Section title="Información básica" desc="Datos principales que aparecen en el catálogo y la ficha de producto.">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Nombre" required>
                <input required type="text" value={form.name} onChange={e => handleNameChange(e.target.value)} className={inputCls} placeholder="FIN-GRASS PLUS" />
              </Field>
              <Field label="Categoría" required hint="Categoría principal visible en el catálogo.">
                <select required value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                  <option value="">— Seleccioná una categoría —</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Tipo de producto (subcategoría)" hint="Filtra los productos en el catálogo por tipo. Debe coincidir exactamente con las opciones del catálogo.">
              <select value={form.subcategory ?? ''} onChange={e => set('subcategory', e.target.value || null)} className={inputCls}>
                <option value="">— Sin subcategoría —</option>
                {SUBCATEGORY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Slug" hint="URL del producto. Se genera del nombre si lo dejás vacío.">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 focus-within:border-femavi-500 focus-within:ring-2 focus-within:ring-femavi-100 transition">
                <span className="text-slate-400 text-sm font-mono">/catalogo/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => set('slug', e.target.value)}
                  className="flex-1 py-2.5 bg-transparent outline-none text-sm font-mono"
                  placeholder="fin-grass-plus"
                />
              </div>
            </Field>
            <Field label="Headline" hint="Frase corta que aparece en la card del catálogo y bajo el título de la ficha.">
              <input type="text" value={form.headline ?? ''} onChange={e => set('headline', e.target.value)} className={inputCls} placeholder="El desengrasante que las flotas eligen…" />
            </Field>
            <Field label="Descripción" required>
              <textarea required rows={4} value={form.description} onChange={e => set('description', e.target.value)} className={inputCls} placeholder="Descripción técnica detallada del producto…" />
            </Field>
            <Field label="Historia detrás del producto" hint="Aparece como bloque destacado en el modal de detalle. Opcional.">
              <textarea rows={3} value={form.story ?? ''} onChange={e => set('story', e.target.value)} className={inputCls} />
            </Field>
          </Section>

          <Section title="Imagen" desc="Foto del producto. Recomendado: PNG transparente, 600×600 mínimo.">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="w-44 h-44 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.image_url ? (
                  <img src={form.image_url} alt="preview" className="max-w-full max-h-full object-contain p-3" />
                ) : (
                  <div className="text-center text-slate-300">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
              </div>
              <div className="flex-1 w-full space-y-3">
                <Field label="URL de la imagen" hint="O subí un archivo abajo y se completa automáticamente.">
                  <input type="text" value={form.image_url ?? ''} onChange={e => set('image_url', e.target.value)} className={inputCls} placeholder="https://…" />
                </Field>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer text-sm font-semibold transition">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Subiendo…' : 'Subir imagen'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                  </label>
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => set('image_url', '')}
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition"
                    >
                      <X className="w-3.5 h-3.5" /> Quitar imagen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Industrias y beneficios" desc="Tags que ayudan a filtrar el producto en el catálogo y dan contexto al cliente.">
            <Field label="Industrias">
              <ChipPicker options={INDUSTRY_OPTIONS} selected={form.industries} onChange={v => set('industries', v)} />
            </Field>
            <Field label="Beneficios" hint="Podés agregar etiquetas custom además de las predefinidas.">
              <ChipPicker options={BENEFIT_OPTIONS} selected={form.benefits} onChange={v => set('benefits', v)} allowCustom />
            </Field>
          </Section>

          <Section title="Datos técnicos" desc="Aparecen en la ficha del producto como tabla de especificaciones.">
            <Field label="Presentaciones" hint="Una por línea. Ej: Bidón 5L, Bidón 20L, Tambor 200L.">
              <FreeChipsField values={form.presentations} onChange={v => set('presentations', v)} placeholder="Bidón 5L" />
            </Field>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Dilución">
                <input type="text" value={form.dilution ?? ''} onChange={e => set('dilution', e.target.value)} className={inputCls} placeholder="1:10 a 1:20" />
              </Field>
              <Field label="pH">
                <input type="text" value={form.ph ?? ''} onChange={e => set('ph', e.target.value)} className={inputCls} placeholder="6.5-7.5 (neutro)" />
              </Field>
            </div>
            <Field label="Tags internos" hint="Etiquetas libres para uso interno o búsqueda futura.">
              <FreeChipsField values={form.tags} onChange={v => set('tags', v)} placeholder="industria-pesada" />
            </Field>
          </Section>

          <Section title="Visibilidad" desc="Controla dónde y cómo aparece el producto en el sitio público.">
            <div className="grid md:grid-cols-3 gap-3">
              <ToggleCard
                checked={form.featured}
                onChange={v => set('featured', v)}
                title="Destacado"
                desc="Aparece en la home como producto featured"
              />
              <ToggleCard
                checked={form.is_active}
                onChange={v => set('is_active', v)}
                title="Visible al público"
                desc="Si está apagado, no aparece en el sitio"
              />
              <Field label="Orden" hint="Menor = aparece primero">
                <input
                  type="number"
                  value={form.display_order}
                  onChange={e => set('display_order', Number(e.target.value))}
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

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-sm text-slate-900 placeholder:text-slate-400";

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

function ToggleCard({ checked, onChange, title, desc }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <label className={`flex items-start gap-3 px-4 py-3 border rounded-lg cursor-pointer transition ${
      checked ? 'border-femavi-500 bg-femavi-50/50 ring-1 ring-femavi-500/20' : 'border-slate-200 hover:border-slate-300'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-femavi-600 cursor-pointer"
      />
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 leading-snug mt-0.5">{desc}</div>
      </div>
    </label>
  );
}

function ChipPicker({ options, selected, onChange, allowCustom }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; allowCustom?: boolean }) {
  const [custom, setCustom] = useState('');
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  const addCustom = () => {
    const v = custom.trim();
    if (v && !selected.includes(v)) {
      onChange([...selected, v]);
      setCustom('');
    }
  };
  const all = Array.from(new Set([...options, ...selected]));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {all.map(opt => (
          <button
            type="button"
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              selected.includes(opt)
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder="Agregar otro beneficio…"
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:bg-white focus:border-femavi-500"
          />
          <button type="button" onClick={addCustom} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-md transition">
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}

function FreeChipsField({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) {
      onChange([...values, v]);
      setDraft('');
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className={inputCls}
        />
        <button type="button" onClick={add} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition whitespace-nowrap">
          Agregar
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {values.map((v, i) => (
            <span key={`${v}-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1 bg-femavi-50 text-femavi-700 rounded-full text-xs font-semibold ring-1 ring-femavi-200">
              {v}
              <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
