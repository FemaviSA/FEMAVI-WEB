import { useEffect } from 'react';

type Props = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type?: 'website' | 'article' | 'product.item';
  jsonLd?: object | object[];
  noindex?: boolean;
};

const DEFAULT_OG_IMAGE = 'https://www.femavi.com.ar/og-image.png';

/**
 * React 19 hoistea automáticamente los <title>, <meta>, <link> y <script> que
 * renderizamos acá al <head>. No hace falta react-helmet ni similar.
 * Cuando cambia la ruta, React reemplaza/limpia los tags duplicados.
 */
export function SEO({
  title,
  description,
  canonical,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  jsonLd,
  noindex = false,
}: Props) {
  const fullTitle = title.includes('FEMAVI') ? title : `${title} | FEMAVI`;
  const ldArray = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  // React 19 hoistea los tags de abajo apendeándolos al <head>, sin tocar los que ya
  // venían en index.html. Eso dejaba dos <link rel="canonical"> y dos meta description
  // por página, con el genérico primero — o sea, cada ficha declaraba canonical = home.
  // Acá borramos los defaults estáticos una vez que tenemos los reales de la ruta.
  useEffect(() => {
    document.head.querySelectorAll('[data-default]').forEach(el => el.remove());
  }, []);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {/* follow, no nofollow: la página no se indexa, pero conviene que el crawler siga
          igual los enlaces de salida y redescubra el catálogo desde acá. Es lo mismo que
          escribe el 404 estático en scripts/prerender.mjs.
          Queda conviviendo con el <meta robots> global de index.html, que dice
          "index, follow". No es un problema: ante directivas en conflicto vale la más
          restrictiva, así que gana este noindex. */}
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="es_AR" />
      <meta property="og:site_name" content="FEMAVI" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {ldArray.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
}

export const SITE_URL = 'https://www.femavi.com.ar';
