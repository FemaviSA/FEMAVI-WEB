import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building2, Briefcase, Calendar, MessageSquare,
  Loader2, Save, MessageCircle, Send, ExternalLink, Trash2, RotateCcw, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getQuoteById, updateQuoteStatus, softDeleteQuote, restoreQuote } from '../../lib/quotes';
import { useProducts } from '../../hooks/useProducts';
import { AdminLayout } from '../../components/AdminLayout';
import type { QuoteRequest, QuoteStatus } from '../../types/product';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products: allProducts, loading: loadingProducts } = useProducts({ includeInactive: true });

  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<QuoteStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [togglingDelete, setTogglingDelete] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getQuoteById(Number(id))
      .then(q => {
        if (!mounted) return;
        if (!q) {
          setError('Cotización no encontrada.');
        } else {
          setQuote(q);
          setNotes(q.notes ?? '');
        }
      })
      .catch(e => { if (mounted) setError(e?.message ?? 'Error'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  const requestedProducts = useMemo(() => {
    if (!quote) return [];
    return quote.product_slugs
      .map(slug => allProducts.find(p => p.slug === slug) ?? { slug, name: slug, category: '', image_url: null, is_active: false } as any);
  }, [quote, allProducts]);

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!quote) return;
    setSavingStatus(newStatus);
    try {
      await updateQuoteStatus(quote.id, newStatus);
      setQuote({ ...quote, status: newStatus });
      toast.success(`Estado actualizado a "${labelForStatus(newStatus)}"`);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo actualizar el estado');
    } finally {
      setSavingStatus(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!quote) return;
    setSavingNotes(true);
    try {
      await updateQuoteStatus(quote.id, quote.status, notes);
      setQuote({ ...quote, notes });
      toast.success('Notas guardadas');
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudieron guardar las notas');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!quote) return;
    if (!confirm(`¿Ocultar la cotización de "${quote.name}" del listado?\n\nQueda guardada en la base. Podés restaurarla desde el filtro "Eliminadas".`)) return;
    setTogglingDelete(true);
    try {
      await softDeleteQuote(quote.id);
      setQuote({ ...quote, deleted_at: new Date().toISOString() });
      toast.success('Cotización ocultada (no se borró de la base)');
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo ocultar');
    } finally {
      setTogglingDelete(false);
    }
  };

  const handleRestore = async () => {
    if (!quote) return;
    setTogglingDelete(true);
    try {
      await restoreQuote(quote.id);
      setQuote({ ...quote, deleted_at: null });
      toast.success('Cotización restaurada');
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo restaurar');
    } finally {
      setTogglingDelete(false);
    }
  };

  if (loading || loadingProducts) {
    return (
      <AdminLayout crumbs={[{ label: 'Cotizaciones', to: '/admin/cotizaciones' }, { label: 'Cargando…' }]}>
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando cotización…
        </div>
      </AdminLayout>
    );
  }

  if (error || !quote) {
    return (
      <AdminLayout crumbs={[{ label: 'Cotizaciones', to: '/admin/cotizaciones' }, { label: 'Error' }]}>
        <div className="bg-white rounded-xl border border-red-200 py-12 px-6 text-center">
          <h2 className="text-lg font-bold text-red-700 mb-2">No pudimos cargar esta cotización</h2>
          <p className="text-sm text-slate-500 mb-6">{error ?? 'Cotización no encontrada.'}</p>
          <button onClick={() => navigate('/admin/cotizaciones')} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg">
            Volver al listado
          </button>
        </div>
      </AdminLayout>
    );
  }

  const productListText = requestedProducts.map((p, i) => `${i + 1}. ${p.name}${p.category ? ` (${p.category})` : ''}`).join('\n');
  const replyText = `Hola ${quote.name},\n\nGracias por tu interés en FEMAVI. Recibimos tu solicitud de cotización por los siguientes productos:\n\n${productListText}\n\nTe envío la cotización adjunta. Quedo a disposición para cualquier consulta.\n\nSaludos,\nEquipo FEMAVI`;
  const waText = `Hola ${quote.name}, te escribo de FEMAVI por tu solicitud de cotización por ${requestedProducts.length} producto${requestedProducts.length !== 1 ? 's' : ''}.`;
  const waPhone = (quote.phone ?? '').replace(/\D/g, '');

  return (
    <AdminLayout
      crumbs={[
        { label: 'Cotizaciones', to: '/admin/cotizaciones' },
        { label: `#${quote.id} · ${quote.name}` },
      ]}
      actions={
        <Link to="/admin/cotizaciones" className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-2 transition">
          <ArrowLeft className="w-4 h-4" /> Listado
        </Link>
      }
    >
      {quote.deleted_at && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Esta cotización está oculta del listado.</strong>{' '}
            Está guardada en la base de datos y podés restaurarla desde el botón "Restaurar" abajo a la derecha. Soft delete del {new Date(quote.deleted_at).toLocaleString('es-AR')}.
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Solicitud #{quote.id}</div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{quote.name}</h1>
                <div className="text-sm text-slate-500 mt-1">
                  {quote.industry ?? 'Sin rubro especificado'} · {new Date(quote.created_at).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <StatusPill status={quote.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field icon={Mail} label="Email">
                <a href={`mailto:${quote.email}`} className="text-femavi-600 hover:underline font-medium">{quote.email}</a>
              </Field>
              {quote.phone && (
                <Field icon={Phone} label="Teléfono">
                  <a href={`tel:${quote.phone}`} className="text-femavi-600 hover:underline font-medium">{quote.phone}</a>
                </Field>
              )}
              {quote.company && (
                <Field icon={Building2} label="Empresa">
                  <span className="text-slate-900 font-medium">{quote.company}</span>
                </Field>
              )}
              {quote.industry && (
                <Field icon={Briefcase} label="Rubro">
                  <span className="text-slate-900 font-medium">{quote.industry}</span>
                </Field>
              )}
              <Field icon={Calendar} label="Fecha de solicitud">
                <span className="text-slate-900 font-medium">{new Date(quote.created_at).toLocaleString('es-AR')}</span>
              </Field>
            </div>

            {quote.message && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="flex items-start gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mensaje del cliente</div>
                </div>
                <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap pl-6">{quote.message}</p>
              </div>
            )}
          </div>

          {/* Productos solicitados */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-900">
                Productos solicitados
                <span className="ml-2 text-sm font-normal text-slate-500">({requestedProducts.length})</span>
              </h2>
            </div>
            {requestedProducts.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500 text-center">
                No se especificaron productos. El cliente solo dejó el mensaje.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {requestedProducts.map((p, i) => (
                  <li key={p.slug} className="px-6 py-4 flex items-center gap-4">
                    <div className="text-xs font-bold text-slate-400 w-6">{i + 1}.</div>
                    <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="max-w-full max-h-full object-contain p-1" />
                        : <span className="text-slate-300 text-xs">—</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
                      {p.category && <div className="text-xs text-slate-500">{p.category}</div>}
                      {!p.is_active && p.id && (
                        <div className="text-[11px] text-amber-600 mt-0.5">⚠ Producto actualmente oculto en el sitio</div>
                      )}
                      {!p.id && (
                        <div className="text-[11px] text-red-600 mt-0.5">⚠ Producto no encontrado en la base (slug: {p.slug})</div>
                      )}
                    </div>
                    {p.id && (
                      <Link
                        to={`/admin/products/${p.id}`}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-femavi-600 hover:bg-femavi-50 rounded-md inline-flex items-center gap-1 transition"
                      >
                        Editar producto <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notas internas */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Notas internas</h2>
            <p className="text-xs text-slate-500 mb-3">Visible solo para el equipo de FEMAVI. El cliente nunca las ve.</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Ej: Llamé el martes, derivado a Juan, esperando que envíe consumo mensual…"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-femavi-500 focus:ring-2 focus:ring-femavi-100 outline-none transition text-sm"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes || notes === (quote.notes ?? '')}
              className="mt-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition"
            >
              {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingNotes ? 'Guardando…' : 'Guardar notas'}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick reply */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Responder al cliente</h3>
            <div className="space-y-2">
              <a
                href={`mailto:${quote.email}?subject=${encodeURIComponent('FEMAVI — Cotización solicitada')}&body=${encodeURIComponent(replyText)}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-femavi-500 hover:bg-femavi-600 text-white text-sm font-semibold rounded-lg transition"
              >
                <Send className="w-4 h-4" />
                Enviar email
              </a>
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              El email pre-carga un draft con la lista de productos. Lo terminás de editar en tu cliente de mail.
            </p>
          </div>

          {/* Cambiar estado */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Estado de la solicitud</h3>
            <div className="space-y-2">
              {(['new', 'contacted', 'closed'] as QuoteStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={savingStatus !== null || quote.status === s}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-between gap-2 ${
                    quote.status === s
                      ? statusBg(s)
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  } disabled:cursor-not-allowed`}
                >
                  <span>{labelForStatus(s)}</span>
                  {quote.status === s && <span className="text-xs opacity-75">actual</span>}
                  {savingStatus === s && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              Marcá <strong>Contactada</strong> cuando ya hablaste con el cliente, y <strong>Cerrada</strong> cuando termines la gestión.
            </p>
          </div>

          {/* Soft delete / restore */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Visibilidad</h3>
            {quote.deleted_at ? (
              <>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  Esta cotización está oculta del listado. Restaurala para que vuelva a aparecer.
                </p>
                <button
                  onClick={handleRestore}
                  disabled={togglingDelete}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-femavi-500 hover:bg-femavi-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
                >
                  {togglingDelete ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Restaurar cotización
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  "Ocultar" hace soft delete: el registro queda en la base pero deja de aparecer en el listado. Reversible.
                </p>
                <button
                  onClick={handleSoftDelete}
                  disabled={togglingDelete}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 ring-1 ring-red-200 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                >
                  {togglingDelete ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Ocultar del listado
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: QuoteStatus }) {
  const cls = status === 'new'
    ? 'bg-red-50 text-red-700 ring-red-200/60'
    : status === 'contacted'
    ? 'bg-amber-50 text-amber-700 ring-amber-200/60'
    : 'bg-slate-100 text-slate-600 ring-slate-200/60';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${cls}`}>
      {status === 'new' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
      {labelForStatus(status)}
    </span>
  );
}

function labelForStatus(s: QuoteStatus) {
  return s === 'new' ? 'Nueva' : s === 'contacted' ? 'Contactada' : 'Cerrada';
}

function statusBg(s: QuoteStatus) {
  return s === 'new' ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
    : s === 'contacted' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    : 'bg-femavi-50 text-femavi-700 ring-1 ring-femavi-200';
}
