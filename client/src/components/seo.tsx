import { Helmet } from "react-helmet-async";
import {
  canonicalOctamyUrl,
  OCTAMY_PUBLIC_ORIGIN,
} from "@shared/public-assessment-routes";

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
const DEFAULT_IMAGE = `${OCTAMY_PUBLIC_ORIGIN}/og-image.png`;

function absoluteImageUrl(image: string): string {
  try {
    const url = new URL(image, OCTAMY_PUBLIC_ORIGIN);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : DEFAULT_IMAGE;
  } catch {
    return DEFAULT_IMAGE;
  }
}

function serializeJsonLd(value: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function SEO({
  title,
  description = DEFAULT_DESC,
  path = "/",
  image = DEFAULT_IMAGE,
  jsonLd,
  noIndex = false,
}: SEOProps) {
  const normalizedTitle = title.trim() || "Octamy";
  const normalizedDescription = description.trim().replace(/\s+/g, " ") || DEFAULT_DESC;
  const fullTitle = /octamy/i.test(normalizedTitle) ? normalizedTitle : `${normalizedTitle} | Octamy`;
  const url = canonicalOctamyUrl(path);
  const imageUrl = absoluteImageUrl(image);
  const structuredData = jsonLd || {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: fullTitle,
    description: normalizedDescription,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "Octamy",
      url: `${OCTAMY_PUBLIC_ORIGIN}/`,
    },
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={normalizedDescription} />
      <meta name="author" content="Octamy Solutions Private Limited" />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1"} />
      <link rel="canonical" href={url} />
      <meta property="og:site_name" content="Octamy" />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={normalizedDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={normalizedDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <script
        id="octamy-page-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
    </Helmet>
  );
}
