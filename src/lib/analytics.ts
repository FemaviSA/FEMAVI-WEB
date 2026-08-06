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
 * La propiedad de GA4 ya existía en la cuenta de FEMAVI (femavi.com.ar - GA4), sin recibir
 * datos porque el sitio nunca estuvo etiquetado. Su ID de medición va como default acá.
 * No es un secreto: los IDs de GA4 son públicos y viajan en el HTML de cualquier página
 * que los use, así que no hay problema en tenerlo en el repo.
 *
 * Solo mide en el dominio de producción. Esa condición es intencional: sin ella, cada
 * `npm run dev` y cada preview de Vercel inyectaría visitas falsas en las métricas del
 * negocio. VITE_GA4_ID permite pisar el ID si alguna vez se quiere una propiedad distinta.
 *
 * QUÉ MIDE
 * - page_view por ruta (un SPA no las dispara solo al navegar)
 * - whatsapp_click: cualquier click a wa.me, capturado con un listener global en vez de
 *   instrumentar los 11 archivos que tienen links de WhatsApp
 * - quote_submitted: al enviarse una cotización (enganchado en lib/quotes.ts)
 * - add_to_quote / view_product: intención de compra por producto
 */

const GA_ID = (import.meta.env.VITE_GA4_ID as string | undefined) || 'G-VZ39Z6MVLY';

/** Único host donde se mide. Ver el comentario de arriba sobre por qué. */
const PROD_HOST = 'www.femavi.com.ar';

function shouldTrack(): boolean {
  return (
    Boolean(GA_ID) &&
    typeof window !== 'undefined' &&
    window.location.hostname === PROD_HOST
  );
}

type Params = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function isAnalyticsEnabled(): boolean {
  return shouldTrack();
}

export function track(event: string, params: Params = {}): void {
  if (!shouldTrack() || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}

export function trackPageView(path: string): void {
  if (!shouldTrack() || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized || !shouldTrack()) return;
  initialized = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  // OJO: tiene que pushear el objeto `arguments`, NO un array. Es lo que hace el snippet
  // oficial de Google y la librería de gtag depende de esa forma exacta. Con parámetros
  // rest (`...args`) se pushea un array de verdad, que se ve igual pero GA4 no procesa:
  // los eventos se encolan y nunca llegan. Por eso está el eslint-disable.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };
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
