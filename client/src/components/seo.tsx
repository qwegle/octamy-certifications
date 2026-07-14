import { Helmet } from "react-helmet-async";
import { canonicalOctamyUrl } from "@shared/public-assessment-routes";

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

export function SEO({
  title,
  description = DEFAULT_DESC,
  path = "/",
  image = DEFAULT_IMAGE,
  jsonLd,
  noIndex = false,
}: SEOProps) {
  const fullTitle = /octamy/i.test(title) ? title : `${title} | Octamy`;
  const url = canonicalOctamyUrl(path);
  const imageUrl = image.startsWith("/") ? canonicalOctamyUrl(image) : image;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="author" content="Octamy Solutions Private Limited" />
      <meta name="robots" content={noIndex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"} />
      <link rel="canonical" href={url} />
      <meta property="og:site_name" content="Octamy" />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
