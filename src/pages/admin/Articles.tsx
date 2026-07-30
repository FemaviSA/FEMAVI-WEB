import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, EyeOff, Calendar, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { listArticles, deleteArticle } from '../../lib/articles';
import { AdminLayout } from '../../components/AdminLayout';
import type { Article } from '../../types/article';

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listArticles({ includeUnpublished: true });
      setArticles(data);
    } catch (e: any) {
      toast.error(`Error cargando artículos: ${e?.message ?? 'desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (a: Article) => {
    if (!confirm(`¿Eliminar "${a.title}"?\n\nEsta acción no se puede deshacer.`)) return;
    setBusyId(a.id);
    try {
      await deleteArticle(a.id);
      setArticles(prev => prev.filter(x => x.id !== a.id));
      toast.success(`"${a.title}" eliminado`);
    } catch (e: any) {
      toast.error(`No se pudo eliminar: ${e?.message ?? 'error'}`);
    } finally {
      setBusyId(null);
    }
  };

  const published = articles.filter(a => a.published);
  const drafts = articles.filter(a => !a.published);

  return (
    <AdminLayout
      crumbs={[{ label: 'Blog' }]}
      actions={
        <Link
          to="/admin/blog/new"
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo artículo
        </Link>
      }
    >
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Blog</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          Artículos publicados en{' '}
          <a href="/blog" target="_blank" rel="noopener" className="text-femavi-600 hover:underline font-medium">/blog</a>
          {' '}del sitio público.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Publicados</div>
          <div className="text-3xl font-bold text-femavi-600">{loading ? '—' : published.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Borradores</div>
          <div className="text-3xl font-bold text-slate-400">{loading ? '—' : drafts.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Total</div>
          <div className="text-3xl font-bold text-slate-900">{loading ? '—' : articles.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center text-slate-500 text-sm">
          Cargando artículos…
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-20 px-6 text-center">
          <h3 className="text-base font-semibold text-slate-900 mb-2">No hay artículos todavía</h3>
          <p className="text-sm text-slate-500 mb-6">Creá el primero para empezar a generar contenido SEO.</p>
          <Link to="/admin/blog/new" className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo artículo
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Artículo</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">Tags</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Publicado</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articles.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-4">
                    <Link to={`/admin/blog/${a.id}`} className="block group">
                      <div className="font-semibold text-sm text-slate-900 group-hover:text-femavi-600 transition leading-snug mb-0.5">{a.title}</div>
                      <div className="text-xs text-slate-400 font-mono">/blog/{a.slug}</div>
                    </Link>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {a.tags.slice(0, 2).map(t => (
                        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-femavi-50 text-femavi-700 rounded text-[10px] font-semibold">
                          <Tag className="w-2.5 h-2.5" />{t}
                        </span>
                      ))}
                      {a.tags.length > 2 && <span className="text-[10px] text-slate-400">+{a.tags.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {a.published ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-femavi-50 text-femavi-700 text-xs font-medium ring-1 ring-femavi-200/60">
                        <Eye className="w-3 h-3" /> Publicado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                        <EyeOff className="w-3 h-3" /> Borrador
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {a.published_at ? (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(a.published_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <a
                        href={`/blog/${a.slug}`}
                        target="_blank"
                        rel="noopener"
                        className="p-2 text-slate-500 hover:text-femavi-600 hover:bg-femavi-50 rounded-md transition"
                        title="Ver en el sitio"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <Link
                        to={`/admin/blog/${a.id}`}
                        className="p-2 text-slate-500 hover:text-femavi-600 hover:bg-femavi-50 rounded-md transition"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        disabled={busyId === a.id}
                        onClick={() => handleDelete(a)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-40"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
