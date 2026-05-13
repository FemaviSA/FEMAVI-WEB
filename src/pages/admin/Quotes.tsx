import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Mail, Building2, Package, Clock, ChevronRight, Wifi, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { listQuotes, listDeletedQuotes, softDeleteQuote, restoreQuote } from '../../lib/quotes';
import { useQuotesRealtime } from '../../hooks/useQuotesRealtime';
import { AdminLayout } from '../../components/AdminLayout';
import type { QuoteRequest, QuoteStatus } from '../../types/product';

type Filter = 'all' | QuoteStatus | 'deleted';

export default function Quotes() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [deletedQuotes, setDeletedQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [active, deleted] = await Promise.all([listQuotes(), listDeletedQuotes()]);
      setQuotes(active);
      setDeletedQuotes(deleted);
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleSoftDelete = async (q: QuoteRequest) => {
    if (!confirm(`¿Ocultar la cotización de "${q.name}" del listado?\n\nQueda guardada en la base de datos. Podés restaurarla desde el filtro "Eliminadas".`)) return;
    setBusyId(q.id);
    try {
      await softDeleteQuote(q.id);
      setQuotes(prev => prev.filter(x => x.id !== q.id));
      setDeletedQuotes(prev => [{ ...q, deleted_at: new Date().toISOString() }, ...prev]);
      toast.success(`Cotización de ${q.name} ocultada (no se borró de la base)`);
    } catch (e: any) {
      toast.error(`No se pudo ocultar: ${e?.message ?? 'error'}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (q: QuoteRequest) => {
    setBusyId(q.id);
    try {
      await restoreQuote(q.id);
      setDeletedQuotes(prev => prev.filter(x => x.id !== q.id));
      setQuotes(prev => [{ ...q, deleted_at: null }, ...prev]);
      toast.success(`Cotización de ${q.name} restaurada`);
    } catch (e: any) {
      toast.error(`No se pudo restaurar: ${e?.message ?? 'error'}`);
    } finally {
      setBusyId(null);
    }
  };

  // Realtime: nueva cotización aparece arriba; updates mueven entre activas/eliminadas según deleted_at.
  useQuotesRealtime((event) => {
    if (event.type === 'INSERT') {
      const q = event.quote;
      if (q.deleted_at) {
        setDeletedQuotes(prev => prev.some(x => x.id === q.id) ? prev : [q, ...prev]);
      } else {
        setQuotes(prev => prev.some(x => x.id === q.id) ? prev : [q, ...prev]);
        toast.success(`Nueva cotización de ${q.name}`, {
          description: `${q.product_slugs.length} producto${q.product_slugs.length !== 1 ? 's' : ''} · ${q.email}`,
          action: { label: 'Ver', onClick: () => { window.location.href = `/admin/cotizaciones/${q.id}`; } },
          duration: 8000,
        });
      }
    } else if (event.type === 'UPDATE') {
      const q = event.quote;
      const wasDeleted = !!event.old?.deleted_at;
      const isDeleted = !!q.deleted_at;

      if (isDeleted && !wasDeleted) {
        // Pasó a eliminada
        setQuotes(prev => prev.filter(x => x.id !== q.id));
        setDeletedQuotes(prev => prev.some(x => x.id === q.id) ? prev.map(x => x.id === q.id ? q : x) : [q, ...prev]);
      } else if (!isDeleted && wasDeleted) {
        // Restaurada
        setDeletedQuotes(prev => prev.filter(x => x.id !== q.id));
        setQuotes(prev => prev.some(x => x.id === q.id) ? prev.map(x => x.id === q.id ? q : x) : [q, ...prev]);
      } else if (isDeleted) {
        setDeletedQuotes(prev => prev.map(x => x.id === q.id ? q : x));
      } else {
        setQuotes(prev => prev.map(x => x.id === q.id ? q : x));
      }
    } else if (event.type === 'DELETE') {
      // Hard delete (no debería pasar — usamos soft delete) pero por las dudas removemos de ambas.
      setQuotes(prev => prev.filter(x => x.id !== event.old.id));
      setDeletedQuotes(prev => prev.filter(x => x.id !== event.old.id));
    }
  }, 'quotes-list');

  const counts = useMemo(() => ({
    all: quotes.length,
    new: quotes.filter(q => q.status === 'new').length,
    contacted: quotes.filter(q => q.status === 'contacted').length,
    closed: quotes.filter(q => q.status === 'closed').length,
    deleted: deletedQuotes.length,
  }), [quotes, deletedQuotes]);

  const filtered = useMemo(() => {
    let r = filter === 'deleted' ? deletedQuotes : quotes;
    if (filter !== 'all' && filter !== 'deleted') r = r.filter(q => q.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(qq =>
        qq.name.toLowerCase().includes(q) ||
        qq.email.toLowerCase().includes(q) ||
        (qq.company ?? '').toLowerCase().includes(q) ||
        (qq.industry ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [quotes, deletedQuotes, query, filter]);

  return (
    <AdminLayout crumbs={[{ label: 'Cotizaciones' }]}>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Solicitudes de cotización</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Cada vez que un visitante envía el formulario, aparece acá automáticamente con sus datos y los productos seleccionados.
          </p>
        </div>
        <span
          title="Conectado a Supabase Realtime — las nuevas cotizaciones aparecen acá sin recargar"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-femavi-50 text-femavi-700 text-xs font-semibold ring-1 ring-femavi-200/60"
        >
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-femavi-500 opacity-75 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-femavi-500" />
          </span>
          <Wifi className="w-3 h-3" />
          En vivo
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total" value={counts.all} tone="slate" />
        <StatCard label="Nuevas" value={counts.new} tone="red" highlight={counts.new > 0} />
        <StatCard label="Contactadas" value={counts.contacted} tone="amber" />
        <StatCard label="Cerradas" value={counts.closed} tone="femavi" />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre, email, empresa o rubro…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
            {([
              ['all', 'Todas', counts.all],
              ['new', 'Nuevas', counts.new],
              ['contacted', 'Contactadas', counts.contacted],
              ['closed', 'Cerradas', counts.closed],
              ['deleted', 'Eliminadas', counts.deleted],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                  filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  filter === key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                }`}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center text-slate-500 text-sm">
          Cargando cotizaciones…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-20 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {quotes.length === 0 ? 'Todavía no hay cotizaciones' : 'Sin resultados'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {quotes.length === 0
              ? 'Cuando alguien complete el formulario de /cotizar o el de la home, aparece acá automáticamente con sus datos y los productos que seleccionó.'
              : 'Probá con otra búsqueda o cambiá el filtro.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {filtered.map(q => {
              const isDeleted = !!q.deleted_at;
              return (
                <li key={q.id} className="flex items-stretch">
                  <Link to={`/admin/cotizaciones/${q.id}`} className="flex-1 flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition group min-w-0">
                    <div className="flex-shrink-0">
                      {isDeleted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold ring-1 ring-slate-200/60">
                          Eliminada
                        </span>
                      ) : (
                        <StatusBadge status={q.status} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-4">
                        <div className={`font-semibold text-sm truncate transition ${isDeleted ? 'text-slate-400 line-through' : 'text-slate-900 group-hover:text-femavi-600'}`}>{q.name}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" /> {q.email}
                        </div>
                      </div>
                      <div className="md:col-span-3 text-xs text-slate-600 min-w-0">
                        {q.company && (
                          <div className="flex items-center gap-1 truncate">
                            <Building2 className="w-3 h-3 flex-shrink-0 text-slate-400" /> {q.company}
                          </div>
                        )}
                        {q.industry && <div className="text-slate-400 truncate ml-4">{q.industry}</div>}
                      </div>
                      <div className="md:col-span-2 text-xs">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-femavi-50 text-femavi-700 font-semibold ring-1 ring-femavi-200/60">
                          <Package className="w-3 h-3" />
                          {q.product_slugs.length} producto{q.product_slugs.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="md:col-span-2 text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatRelative(q.created_at)}
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-femavi-600 transition" />
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center pr-3">
                    {isDeleted ? (
                      <button
                        disabled={busyId === q.id}
                        onClick={() => handleRestore(q)}
                        className="p-2 text-slate-500 hover:text-femavi-600 hover:bg-femavi-50 rounded-md transition disabled:opacity-40"
                        title="Restaurar"
                        aria-label={`Restaurar cotización de ${q.name}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        disabled={busyId === q.id}
                        onClick={() => handleSoftDelete(q)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-40"
                        title="Ocultar (no se borra de la base)"
                        aria-label={`Ocultar cotización de ${q.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, tone, highlight }: { label: string; value: number; tone: 'slate' | 'red' | 'amber' | 'femavi'; highlight?: boolean }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    femavi: 'text-femavi-600',
  };
  return (
    <div className={`bg-white border rounded-xl p-5 transition ${highlight ? 'border-red-200 ring-2 ring-red-100' : 'border-slate-200'}`}>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  if (status === 'new') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold ring-1 ring-red-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Nueva
      </span>
    );
  }
  if (status === 'contacted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold ring-1 ring-amber-200/60">
        Contactada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
      Cerrada
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
  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr < 24) return `hace ${diffHr}h`;
  if (diffDay < 7) return `hace ${diffDay}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
