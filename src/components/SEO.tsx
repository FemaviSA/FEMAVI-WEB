type Props = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type?: 'website' | 'article' | 'product.item';
  jsonLd?: object | object[];
  noindex?: boolean;
};

const DEFAULT_OG_IMAGE = 'https://femavi-web.vercel.app/og-image.png';

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

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

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

export const SITE_URL = 'https://femavi-web.vercel.app';
