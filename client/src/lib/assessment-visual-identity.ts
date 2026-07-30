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

const MONOCHROME_PALETTE = {
  paletteName: "monochrome",
  headerClass: "from-black via-neutral-900 to-neutral-700",
  accentClass: "bg-white",
  softClass: "border-neutral-300 bg-neutral-100 text-neutral-950",
} as const;

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

export function getAssessmentVisualIdentity(input: {
  slug: string;
  title: string;
  category?: string;
}): AssessmentVisualIdentity {
  const searchable = `${input.title} ${input.category ?? ""} ${input.slug}`.toLowerCase();
  const topic = TOPICS.find(({ pattern }) => pattern.test(searchable)) ?? {
    iconKey: "graduation" as const,
    topicLabel: "Exam preparation",
  };
  return { ...MONOCHROME_PALETTE, ...topic };
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
