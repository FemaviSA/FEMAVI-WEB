import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Package, ExternalLink, LogOut, Menu, X, ChevronRight, Mail, BookOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getQuoteCounts } from '../lib/quotes';
import { useQuotesRealtime } from '../hooks/useQuotesRealtime';

type Crumb = { label: string; to?: string };

export function AdminLayout({
  children,
  crumbs = [],
  actions,
}: {
  children: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newQuotes, setNewQuotes] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const c = await getQuoteCounts();
        if (mounted) setNewQuotes(c.new);
      } catch {
        // ignore
      }
    };
    load();
    // Polling cada 60s como red de seguridad (por si websocket reconnect falla).
    const id = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Update inmediato del badge cuando llega un evento realtime.
  useQuotesRealtime((event) => {
    if (event.type === 'INSERT' && event.quote.status === 'new') {
      setNewQuotes(n => n + 1);
    } else if (event.type === 'UPDATE') {
      const oldStatus = event.old?.status;
      const newStatus = event.quote.status;
      if (oldStatus !== 'new' && newStatus === 'new') setNewQuotes(n => n + 1);
      else if (oldStatus === 'new' && newStatus !== 'new') setNewQuotes(n => Math.max(0, n - 1));
    } else if (event.type === 'DELETE' && event.old.status === 'new') {
      setNewQuotes(n => Math.max(0, n - 1));
    }
  }, 'sidebar-badge');

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
      isActive
        ? 'bg-femavi-500/10 text-femavi-400 ring-1 ring-femavi-500/20'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-950 text-white z-50 flex flex-col transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/5">
          <Link to="/admin" className="flex items-center gap-2.5">
            <img src="/logo-femavi.png" alt="FEMAVI" className="h-8 w-auto rounded" />
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Admin Panel</div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
            Gestión
          </div>
          <NavLink to="/admin" end className={navItem}>
            <Package className="w-4 h-4" />
            <span className="flex-1">Productos</span>
          </NavLink>
          <NavLink to="/admin/cotizaciones" className={navItem}>
            <Mail className="w-4 h-4" />
            <span className="flex-1">Cotizaciones</span>
            {newQuotes > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {newQuotes}
              </span>
            )}
          </NavLink>
          <NavLink to="/admin/blog" className={navItem}>
            <BookOpen className="w-4 h-4" />
            <span className="flex-1">Blog</span>
          </NavLink>
        </nav>

        <div className="px-3 py-4 border-t border-white/5 space-y-1">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <ExternalLink className="w-4 h-4" />
            Ver sitio público
          </a>
          <div className="px-4 py-3 mt-2 rounded-lg bg-white/5 border border-white/5">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
              Sesión
            </div>
            <div className="text-xs text-slate-200 truncate" title={user?.email ?? ''}>
              {user?.email ?? '—'}
            </div>
            <button
              onClick={handleSignOut}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
          <div className="px-6 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
                aria-label="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
              <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
                {crumbs.map((c, i) => (
                  <span key={i} className="flex items-center gap-2 min-w-0">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    {c.to ? (
                      <Link to={c.to} className="text-slate-500 hover:text-slate-900 transition truncate">
                        {c.label}
                      </Link>
                    ) : (
                      <span className="text-slate-900 font-semibold truncate">{c.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
            {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
