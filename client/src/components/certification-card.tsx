import { Link } from "wouter";
import {
  ArrowUpRight,
  Atom,
  Award,
  BrainCircuit,
  BriefcaseBusiness,
  Calculator,
  Clock3,
  Cloud,
  Code2,
  GraduationCap,
  Languages,
  Landmark,
  PackageOpen,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAssessmentCardPricing,
  getAssessmentVisualIdentity,
  type AssessmentIconKey,
} from "@/lib/assessment-visual-identity";
import { publicAssessmentPath, publicPracticePath } from "@shared/public-assessment-routes";

export type CertificationCardItem = {
  id: number;
  title: string;
  description: string;
  slug: string;
  duration?: number | null;
  passingScore?: number | null;
  price?: string | null;
  originalPrice?: string | null;
  isOnSale?: boolean;
  level?: string | null;
  thumbnailUrl?: string | null;
  subscriptionEligible?: boolean;
  originLabel: string;
  certificationLabel: string;
  canonicalPath?: string;
  assessmentPurpose?: "certification" | "practice";
  creator?: { displayName: string; slug: string } | null;
  category: { name: string; slug: string };
  audienceBands?: Array<{ id: number; code: string; label: string }>;
};

const levelLabels: Record<string, string> = {
  novice: "Foundation",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const topicIcons: Record<AssessmentIconKey, LucideIcon> = {
  atom: Atom,
  brain: BrainCircuit,
  briefcase: BriefcaseBusiness,
  calculator: Calculator,
  cloud: Cloud,
  code: Code2,
  containers: PackageOpen,
  graduation: GraduationCap,
  language: Languages,
  landmark: Landmark,
  security: ShieldCheck,
};

export function CertificationCard({
  item,
  categoryHref,
  variant = "certification",
}: {
  item: CertificationCardItem;
  categoryHref?: string;
  variant?: "certification" | "practice";
}) {
  const practice = variant === "practice" || item.assessmentPurpose === "practice";
  const cardKind = practice ? "practice" : "certification";
  const href = item.canonicalPath || (practice ? publicPracticePath(item.slug) : publicAssessmentPath(item.slug));
  const identity = getAssessmentVisualIdentity({
    slug: item.slug,
    title: item.title,
    category: item.category.name,
  });
  const pricing = getAssessmentCardPricing({
    variant: cardKind,
    price: item.price,
    originalPrice: item.originalPrice,
    isOnSale: item.isOnSale,
  });
  const TopicIcon = topicIcons[identity.iconKey];
  const metadata = [
    typeof item.duration === "number" ? { icon: Clock3, label: `${item.duration} min` } : null,
    typeof item.passingScore === "number" ? { icon: ShieldCheck, label: `Pass at ${item.passingScore}%` } : null,
  ].filter((entry): entry is { icon: LucideIcon; label: string } => entry !== null);

  return (
    <article
      data-card-kind={cardKind}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] transition duration-300 hover:-translate-y-1 ${
        practice
          ? "border-2 border-violet-200 bg-violet-50/40 shadow-[0_14px_38px_-25px_rgba(91,33,182,0.65)] hover:border-violet-400 hover:shadow-violet-900/15"
          : "border border-slate-200 bg-white shadow-[0_14px_38px_-27px_rgba(15,23,42,0.55)] hover:border-slate-400 hover:shadow-slate-900/15"
      }`}
    >
      {practice && <div aria-hidden className="absolute inset-x-6 top-0 z-20 border-t-4 border-dashed border-amber-300" />}
      <Link href={href} className={`relative block min-h-48 overflow-hidden bg-gradient-to-br p-5 text-white ${identity.headerClass}`}>
        <div aria-hidden className="absolute -right-12 -top-14 h-40 w-40 rounded-full border-[28px] border-white/10 transition duration-500 group-hover:scale-110" />
        <div aria-hidden className={`absolute bottom-0 left-0 h-1.5 w-full ${identity.accentClass}`} />
        <div className="relative flex h-full min-h-36 flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] backdrop-blur-sm">
              {practice ? <TicketCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Award className="h-3.5 w-3.5" aria-hidden="true" />}
              {practice ? "Practice exam" : "Certification exam"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-2 text-xs font-bold backdrop-blur-sm">
              <TopicIcon className="h-4 w-4" aria-hidden="true" />
              {identity.topicLabel}
            </span>
          </div>
          <div className="mt-7 flex items-end gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-sm" aria-hidden="true">
              <TopicIcon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">{item.category.name}</p>
              <h2 className="mt-1 line-clamp-3 text-xl font-black leading-tight tracking-[-0.025em]">{item.title}</h2>
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          {categoryHref ? (
            <Link href={categoryHref}>
              <Badge variant="outline" className={`rounded-full ${identity.softClass}`}>{item.category.name}</Badge>
            </Link>
          ) : (
            <Badge variant="outline" className={`rounded-full ${identity.softClass}`}>{item.category.name}</Badge>
          )}
          {item.level && <Badge variant="outline" className="rounded-full border-slate-200 bg-white">{levelLabels[item.level] || item.level}</Badge>}
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.description}</p>
        {item.audienceBands?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.audienceBands.slice(0, 2).map((band) => <span key={band.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{band.label}</span>)}
          </div>
        ) : null}

        {metadata.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-2 border-y border-slate-100 py-3 text-xs text-slate-600">
            {metadata.map(({ icon: Icon, label }) => <span key={label} className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />{label}</span>)}
          </div>
        )}

        <div className={`mt-auto rounded-2xl p-4 ${practice ? "border border-dashed border-violet-300 bg-white" : "border border-emerald-200 bg-emerald-50/70"}`}>
          <p className={`flex items-center gap-1.5 text-sm font-black ${practice ? "text-violet-900" : "text-emerald-800"}`}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />{pricing.primaryLabel}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{pricing.supportingLabel}</p>
          {!practice && <p className="mt-2 text-xs font-bold text-slate-800">Account required to start · no charge for the attempt</p>}
          {!practice && pricing.credentialPrice && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 border-t border-emerald-200 pt-3">
              <span className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-500">Verified credential</span>
              <span className="text-xl font-black text-slate-950">{pricing.credentialPrice}</span>
              {pricing.originalCredentialPrice && <span className="text-sm text-slate-500 line-through">{pricing.originalCredentialPrice}</span>}
              {pricing.isCredentialOnSale && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700">Credential sale</span>}
            </div>
          )}
        </div>

        <Button asChild className={`mt-4 w-full rounded-full ${practice ? "bg-violet-700 hover:bg-violet-800" : "bg-slate-950 hover:bg-slate-800"}`}>
          <Link href={href} aria-label={`${practice ? "View practice exam" : "View free certification exam; account required"}: ${item.title}`}>
            {practice ? "View practice exam" : "View free exam · account required"}<ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
