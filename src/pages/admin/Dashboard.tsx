import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2, Eye, EyeOff, RotateCcw, Star, Package,
  Image as ImageIcon, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProducts } from '../../hooks/useProducts';
import { softDeleteProduct, restoreProduct } from '../../lib/products';
import { AdminLayout } from '../../components/AdminLayout';

type Filter = 'all' | 'active' | 'hidden' | 'featured';

export default function Dashboard() {
  const { products, loading, refresh } = useProducts({ includeInactive: true });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const stats = useMemo(() => {
    const active = products.filter(p => p.is_active);
    const featured = active.filter(p => p.featured);
    const lastUpdate = products
      .map(p => p.updated_at)
      .sort()
      .reverse()[0];
    return {
      total: products.length,
      active: active.length,
      hidden: products.length - active.length,
      featured: featured.length,
      lastUpdate,
    };
  }, [products]);

  const filtered = useMemo(() => {
    let r = products;
    if (filter === 'active') r = r.filter(p => p.is_active);
    else if (filter === 'hidden') r = r.filter(p => !p.is_active);
    else if (filter === 'featured') r = r.filter(p => p.featured && p.is_active);

    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
      );
    }
    return r;
  }, [products, query, filter]);

  const handleSoftDelete = async (id: number, name: string) => {
    if (!confirm(`¿Ocultar "${name}" del sitio público?\n\nEl producto deja de ser visible pero queda guardado en la base. Podés reactivarlo cuando quieras.`)) return;
    setBusyId(id);
    try {
      await softDeleteProduct(id);
      await refresh();
      toast.success(`"${name}" oculto del sitio público`);
    } catch (e: any) {
      toast.error(`No se pudo ocultar: ${e?.message ?? 'error'}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (id: number, name: string) => {
    setBusyId(id);
    try {
      await restoreProduct(id);
      await refresh();
      toast.success(`"${name}" reactivado en el sitio público`);
    } catch (e: any) {
      toast.error(`No se pudo reactivar: ${e?.message ?? 'error'}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout
      crumbs={[{ label: 'Productos' }]}
      actions={
        <Link
          to="/admin/products/new"
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </Link>
      }
    >
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Catálogo de productos</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          Administrá la información que aparece en{' '}
          <a href="/catalogo" target="_blank" rel="noopener" className="text-femavi-600 hover:underline font-medium">
            /catalogo
          </a>{' '}
          del sitio público.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Package}
          label="Productos totales"
          value={stats.total}
          tone="slate"
          loading={loading}
        />
        <StatCard
          icon={Eye}
          label="Visibles en el sitio"
          value={stats.active}
          tone="femavi"
          loading={loading}
        />
        <StatCard
          icon={Star}
          label="Destacados (home)"
          value={stats.featured}
          tone="amber"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="Última edición"
          value={stats.lastUpdate ? formatRelative(stats.lastUpdate) : '—'}
          tone="sky"
          loading={loading}
          isText
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre, categoría o slug…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {([
              ['all', 'Todos', stats.total],
              ['active', 'Visibles', stats.active],
              ['hidden', 'Ocultos', stats.hidden],
              ['featured', 'Destacados', stats.featured],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                  filter === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  filter === key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center text-slate-500 text-sm">
          Cargando productos…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-20 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Sin resultados</h3>
          <p className="text-sm text-slate-500 mb-6">
            {query ? `Ningún producto coincide con "${query}"` : 'No hay productos en este filtro.'}
          </p>
          {query && (
            <button
              onClick={() => { setQuery(''); setFilter('all'); }}
              className="text-sm font-semibold text-femavi-600 hover:text-femavi-700"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Producto</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Industrias</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition group">
                  <td className="px-5 py-3.5">
                    <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 group/row">
                      <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="max-w-full max-h-full object-contain p-1" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm group-hover/row:text-femavi-600 transition flex items-center gap-1.5">
                          {p.name}
                          {p.featured && p.is_active && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono truncate">{p.slug}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <CategoryPill category={p.category} />
                  </td>
                  <td className="px-5 py-3.5">
                    {p.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-femavi-50 text-femavi-700 text-xs font-medium ring-1 ring-femavi-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-femavi-500" />
                        Visible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                        <EyeOff className="w-3 h-3" />
                        Oculto
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {p.industries.slice(0, 2).map(ind => (
                        <span key={ind} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                          {ind}
                        </span>
                      ))}
                      {p.industries.length > 2 && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium">
                          +{p.industries.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="p-2 text-slate-500 hover:text-femavi-600 hover:bg-femavi-50 rounded-md transition"
                        title="Editar producto"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      {p.is_active ? (
                        <button
                          disabled={busyId === p.id}
                          onClick={() => handleSoftDelete(p.id, p.name)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-40"
                          title="Ocultar del sitio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          disabled={busyId === p.id}
                          onClick={() => handleRestore(p.id, p.name)}
                          className="p-2 text-slate-500 hover:text-femavi-600 hover:bg-femavi-50 rounded-md transition disabled:opacity-40"
                          title="Reactivar"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({
  icon: Icon, label, value, tone, loading, isText = false,
}: {
  icon: typeof Package;
  label: string;
  value: number | string;
  tone: 'slate' | 'femavi' | 'amber' | 'sky';
  loading?: boolean;
  isText?: boolean;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-600 ring-slate-200',
    femavi: 'bg-femavi-50 text-femavi-600 ring-femavi-200',
    amber: 'bg-amber-50 text-amber-600 ring-amber-200',
    sky: 'bg-sky-50 text-sky-600 ring-sky-200',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-sm transition">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={isText ? 'text-base font-semibold text-slate-900' : 'text-3xl font-bold text-slate-900 tracking-tight'}>
        {loading ? <span className="text-slate-300">—</span> : value}
      </div>
    </div>
  );
}

const CATEGORY_TONES: Record<string, string> = {
  'Higiene Industrial': 'bg-blue-50 text-blue-700 ring-blue-200',
  'Producción': 'bg-orange-50 text-orange-700 ring-orange-200',
  'Aceites y Lubricantes': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'Grasas': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Aerosoles': 'bg-sky-50 text-sky-700 ring-sky-200',
  'Tratamiento de Agua': 'bg-teal-50 text-teal-700 ring-teal-200',
  'Papel': 'bg-stone-100 text-stone-700 ring-stone-200',
  'Línea Daurange': 'bg-violet-50 text-violet-700 ring-violet-200',
};

function CategoryPill({ category }: { category: string }) {
  const tone = CATEGORY_TONES[category] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ${tone}`}>
      {category}
    </span>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Hace instantes';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
