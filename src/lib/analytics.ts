/**
 * Medición de tráfico y conversiones (Google Analytics 4).
 *
 * POR QUÉ EXISTE
 * Hasta ahora el sitio no medía nada: el snippet de GA estaba comentado en index.html con
 * un ID de ejemplo. Entraban ~7 pedidos de cotización por mes sin forma de saber de dónde
 * venían, qué producto habían mirado antes, ni cuánta gente clickeaba WhatsApp — que es
 * probablemente el canal de conversión principal y no dejaba ningún rastro.
 *
 * CÓMO SE ACTIVA
 * Definiendo VITE_GA4_ID (formato G-XXXXXXXXXX) en las variables de entorno de Vercel.
 * Sin esa variable, todo esto es no-op: no carga scripts de terceros ni rompe nada. Eso
 * mantiene el entorno local y los previews limpios de datos falsos.
 *
 * QUÉ MIDE
 * - page_view por ruta (un SPA no las dispara solo al navegar)
 * - whatsapp_click: cualquier click a wa.me, capturado con un listener global en vez de
 *   instrumentar los 11 archivos que tienen links de WhatsApp
 * - quote_submitted: al enviarse una cotización (enganchado en lib/quotes.ts)
 * - add_to_quote / view_product: intención de compra por producto
 */

const GA_ID = import.meta.env.VITE_GA4_ID as string | undefined;

type Params = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(GA_ID);
}

export function track(event: string, params: Params = {}): void {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}

export function trackPageView(path: string): void {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized || !GA_ID || typeof window === 'undefined') return;
  initialized = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  // send_page_view en false: las páginas las mandamos nosotros en cada cambio de ruta,
  // si no la primera se contaría dos veces.
  window.gtag('config', GA_ID, { send_page_view: false });

  // Un solo listener en capture para todos los links de WhatsApp del sitio. Evita tener
  // que tocar (y mantener) los 11 archivos que los tienen, y captura también los que se
  // agreguen en el futuro.
  document.addEventListener(
    'click',
    e => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest?.('a[href*="wa.me"]') as HTMLAnchorElement | null;
      if (!link) return;
      track('whatsapp_click', {
        page_path: window.location.pathname,
        link_url: link.getAttribute('href') ?? '',
      });
    },
    { capture: true }
  );
}
