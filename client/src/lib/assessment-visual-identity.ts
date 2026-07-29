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
  { paletteName: "indigo", headerClass: "from-indigo-950 via-indigo-800 to-violet-600", accentClass: "bg-indigo-300", softClass: "bg-indigo-50 text-indigo-900 border-indigo-200" },
  { paletteName: "cyan", headerClass: "from-cyan-950 via-sky-800 to-cyan-500", accentClass: "bg-cyan-300", softClass: "bg-cyan-50 text-cyan-950 border-cyan-200" },
  { paletteName: "emerald", headerClass: "from-emerald-950 via-emerald-800 to-teal-500", accentClass: "bg-emerald-300", softClass: "bg-emerald-50 text-emerald-950 border-emerald-200" },
  { paletteName: "amber", headerClass: "from-amber-950 via-orange-800 to-amber-500", accentClass: "bg-amber-300", softClass: "bg-amber-50 text-amber-950 border-amber-200" },
  { paletteName: "rose", headerClass: "from-rose-950 via-rose-800 to-pink-500", accentClass: "bg-rose-300", softClass: "bg-rose-50 text-rose-950 border-rose-200" },
  { paletteName: "slate", headerClass: "from-slate-950 via-slate-700 to-blue-600", accentClass: "bg-blue-300", softClass: "bg-slate-100 text-slate-950 border-slate-300" },
  { paletteName: "purple", headerClass: "from-purple-950 via-purple-800 to-fuchsia-600", accentClass: "bg-fuchsia-300", softClass: "bg-purple-50 text-purple-950 border-purple-200" },
  { paletteName: "blue", headerClass: "from-blue-950 via-blue-800 to-sky-500", accentClass: "bg-sky-300", softClass: "bg-blue-50 text-blue-950 border-blue-200" },
  { paletteName: "teal", headerClass: "from-teal-950 via-teal-800 to-emerald-500", accentClass: "bg-teal-300", softClass: "bg-teal-50 text-teal-950 border-teal-200" },
  { paletteName: "red", headerClass: "from-red-950 via-red-800 to-orange-500", accentClass: "bg-orange-300", softClass: "bg-red-50 text-red-950 border-red-200" },
] as const;

// Ordering is intentional: specific technologies and subjects win over broad
// words such as "management", "language", or "practice".
const TOPICS: Array<{ pattern: RegExp; iconKey: AssessmentIconKey; topicLabel: string }> = [
  { pattern: /kubernetes|docker|container|helm/, iconKey: "containers", topicLabel: "Containers" },
  { pattern: /cyber|security|identity and access|soc analyst|threat|ethical hack/, iconKey: "security", topicLabel: "Security" },
  { pattern: /physics|chemistry|biology|neet|general science/, iconKey: "atom", topicLabel: "Science" },
  { pattern: /quantitative|mathematics|math|numerical|arithmetic|aptitude|statistical/, iconKey: "calculator", topicLabel: "Mathematics" },
  { pattern: /generative ai|artificial intelligence|machine learning|deep learning|neural|computer vision|natural language processing|\bnlp\b|\bllm\b|data science|data analytics|data analysis|power bi|\bsql\b|ai ethics/, iconKey: "brain", topicLabel: "Data & AI" },
  { pattern: /sap|oracle|salesforce|servicenow|\berp\b|\bcrm\b|enterprise application/, iconKey: "briefcase", topicLabel: "Enterprise apps" },
  { pattern: /aws|azure|cloud|devops|reliability|infrastructure|linux system|it support|service desk|networking support/, iconKey: "cloud", topicLabel: "Cloud & IT ops" },
  { pattern: /api|microservice|software|typescript|javascript|react|python|java|node\.js|c#|\.net|mobile app|testing|developer|programming|\bcode\b/, iconKey: "code", topicLabel: "Software" },
  { pattern: /bank|finance|account|economics|commerce|investment|ibps|risk management/, iconKey: "landmark", topicLabel: "Finance" },
  { pattern: /english|language|verbal|grammar|vocabulary|comprehension/, iconKey: "language", topicLabel: "Language" },
  { pattern: /reasoning|logical|logic|intelligence|analytical/, iconKey: "brain", topicLabel: "Reasoning" },
  { pattern: /ui\/ux|design/, iconKey: "brain", topicLabel: "Design & UX" },
  { pattern: /business|marketing|management|leadership|sales|strategy|agile|scrum|operations|project|product/, iconKey: "briefcase", topicLabel: "Business" },
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
    topicLabel: "Exam preparation",
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
