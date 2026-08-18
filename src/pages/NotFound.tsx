import { Link } from 'react-router-dom';
import { SEO, SITE_URL } from '../components/SEO';

const C = { bg: '#f6f8fa', white: '#FFFFFF', accent: '#0067ac', dark: '#004370', textMuted: '#5a6f80' };

export default function NotFound() {
  return (
    <>
      {/* Sin esto la pestaña quedaba sin título: el 404.html que sirve Vercel trae uno, pero
          ningún componente lo declaraba y en una navegación interna a una URL rota se
          arrastraba el título de la página anterior. El noindex importa por lo mismo: la
          respuesta del servidor ya viene con 404 y noindex, pero cuando se llega acá
          navegando dentro del SPA no hay request nueva que lo traiga. */}
      <SEO
        title="Página no encontrada (404)"
        description="La página que buscás no existe o cambió de dirección. Entrá al catálogo de productos químicos industriales de FEMAVI."
        canonical={`${SITE_URL}/404`}
        noindex
      />
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 72, fontWeight: 800, color: C.accent, lineHeight: 1 }}>404</div>
        <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 800, color: C.dark, margin: '12px 0' }}>
          Esta página no existe
        </h1>
        <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.6, margin: '0 0 28px' }}>
          El enlace que seguiste puede estar roto o la página fue movida.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ padding: '12px 24px', background: C.accent, color: C.white, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none' }}>
            Ir al inicio
          </Link>
          <Link to="/catalogo" style={{ padding: '12px 24px', border: `1.5px solid ${C.accent}`, color: C.accent, fontSize: 14, fontWeight: 700, borderRadius: 8, textDecoration: 'none' }}>
            Ver catálogo
          </Link>
        </div>
        </div>
      </div>
    </>
  );
}
