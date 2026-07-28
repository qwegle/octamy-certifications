export type AssessmentVisualIdentity = {
  paletteName: string;
  headerClass: string;
  accentClass: string;
  softClass: string;
  iconKey: AssessmentIconKey;
  topicLabel: string;
};

export type AssessmentIconKey =
  | "atom"
  | "brain"
  | "briefcase"
  | "calculator"
  | "cloud"
  | "code"
  | "containers"
  | "graduation"
  | "language"
  | "landmark"
  | "security";

const PALETTES = [
  { paletteName: "indigo", headerClass: "from-indigo-950 via-indigo-800 to-violet-600", accentClass: "bg-indigo-400", softClass: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  { paletteName: "cyan", headerClass: "from-cyan-950 via-sky-800 to-cyan-500", accentClass: "bg-cyan-300", softClass: "bg-cyan-50 text-cyan-900 border-cyan-200" },
  { paletteName: "emerald", headerClass: "from-emerald-950 via-emerald-800 to-teal-500", accentClass: "bg-emerald-300", softClass: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  { paletteName: "amber", headerClass: "from-amber-950 via-orange-800 to-amber-500", accentClass: "bg-amber-300", softClass: "bg-amber-50 text-amber-950 border-amber-200" },
  { paletteName: "rose", headerClass: "from-rose-950 via-rose-800 to-pink-500", accentClass: "bg-rose-300", softClass: "bg-rose-50 text-rose-900 border-rose-200" },
  { paletteName: "slate", headerClass: "from-slate-950 via-slate-700 to-blue-600", accentClass: "bg-blue-300", softClass: "bg-slate-100 text-slate-900 border-slate-300" },
] as const;

const TOPICS: Array<{ pattern: RegExp; iconKey: AssessmentIconKey; topicLabel: string }> = [
  { pattern: /kubernetes|docker|container|helm/, iconKey: "containers", topicLabel: "Containers" },
  { pattern: /aws|azure|cloud|devops|reliability|infrastructure/, iconKey: "cloud", topicLabel: "Cloud & DevOps" },
  { pattern: /cyber|security|network|privacy|ethical hack/, iconKey: "security", topicLabel: "Security" },
  { pattern: /physics|chemistry|biology|neet|science/, iconKey: "atom", topicLabel: "Science" },
  { pattern: /quantitative|mathematics|math|numerical|arithmetic|aptitude/, iconKey: "calculator", topicLabel: "Quantitative" },
  { pattern: /english|language|verbal|grammar|vocabulary/, iconKey: "language", topicLabel: "Language" },
  { pattern: /reasoning|logical|logic|analytical/, iconKey: "brain", topicLabel: "Reasoning" },
  { pattern: /bank|finance|account|economics|commerce|ibps/, iconKey: "landmark", topicLabel: "Finance" },
  { pattern: /business|marketing|management|leadership|sales|strategy/, iconKey: "briefcase", topicLabel: "Business" },
  { pattern: /api|microservice|software|typescript|javascript|react|python|java|code|program/, iconKey: "code", topicLabel: "Software" },
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getAssessmentVisualIdentity(input: {
  slug: string;
  title: string;
  category?: string;
}): AssessmentVisualIdentity {
  const seed = `${input.slug || input.title}`.trim().toLowerCase();
  const searchable = `${input.title} ${input.category ?? ""} ${input.slug}`.toLowerCase();
  const topic = TOPICS.find(({ pattern }) => pattern.test(searchable)) ?? {
    iconKey: "graduation" as const,
    topicLabel: "Professional skills",
  };
  return { ...PALETTES[stableHash(seed) % PALETTES.length], ...topic };
}

export type AssessmentCardPricing = {
  kind: "certification" | "practice";
  primaryLabel: string;
  supportingLabel: string;
  credentialPrice?: string;
  originalCredentialPrice?: string;
  isCredentialOnSale: boolean;
};

function parsePrice(value: unknown): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function getAssessmentCardPricing(input: {
  variant: "certification" | "practice";
  price?: string | number | null;
  originalPrice?: string | number | null;
  isOnSale?: boolean;
}): AssessmentCardPricing {
  if (input.variant === "practice") {
    return {
      kind: "practice",
      primaryLabel: "Included with Practice Pass",
      supportingLabel: "An active Practice Pass is required",
      isCredentialOnSale: false,
    };
  }

  const price = parsePrice(input.price);
  const originalPrice = parsePrice(input.originalPrice);
  const isCredentialOnSale = input.isOnSale === true
    && price !== null
    && originalPrice !== null
    && originalPrice > price;

  return {
    kind: "certification",
    primaryLabel: "Free to attempt",
    supportingLabel: "Pay only after passing to unlock the detailed review and verified credential",
    credentialPrice: price === null ? undefined : formatInr(price),
    originalCredentialPrice: isCredentialOnSale ? formatInr(originalPrice) : undefined,
    isCredentialOnSale,
  };
}
