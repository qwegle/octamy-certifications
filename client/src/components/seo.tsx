import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noIndex?: boolean;
}

const DEFAULT_DESC =
  "Take a scored skill assessment free. If you pass, choose whether to activate a status-aware credential and share the recorded evidence.";
const DEFAULT_IMAGE = "https://octamy.com/og-image.png";
const SITE = "https://octamy.com";

export function SEO({
  title,
  description = DEFAULT_DESC,
  path = "/",
  image = DEFAULT_IMAGE,
  jsonLd,
  noIndex = false,
}: SEOProps) {
  const fullTitle = title.includes("Octamy") ? title : `${title} | Octamy`;
  const url = path.startsWith("http") ? path : `${SITE}${path}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
