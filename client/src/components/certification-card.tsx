import { Link } from "wouter";
import { ArrowUpRight, Award, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publicAssessmentPath, publicPracticePath } from "@shared/public-assessment-routes";

export type CertificationCardItem = {
  id: number;
  title: string;
  description: string;
  slug: string;
  duration: number;
  passingScore: number;
  price: string;
  level: string;
  thumbnailUrl: string | null;
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

const accents: Record<string, string> = {
  ssc: "from-rose-500 via-orange-500 to-amber-400",
  "banking-recruitment": "from-emerald-600 via-teal-600 to-cyan-500",
  "railway-recruitment": "from-cyan-600 via-sky-600 to-blue-600",
  jee: "from-blue-700 via-indigo-600 to-violet-600",
  "neet-ug": "from-fuchsia-600 via-pink-600 to-rose-500",
  mathematics: "from-violet-700 via-indigo-600 to-sky-500",
  physics: "from-slate-800 via-blue-800 to-cyan-600",
  chemistry: "from-purple-700 via-fuchsia-600 to-pink-500",
};

export function certificationDisplayTitle(title: string) {
  return title
    .replace(/ Numerical Practice$/i, " Numerical Certification")
    .replace(/ Mathematics Practice$/i, " Mathematics Certification")
    .replace(/ Aptitude Practice$/i, " Aptitude Certification")
    .replace(/ Practice$/i, " Certification Exam")
    .replace(/ Diagnostic$/i, " Skills Diagnostic");
}

export function CertificationCard({ item, categoryHref, variant = "certification" }: { item: CertificationCardItem; categoryHref?: string; variant?: "certification" | "practice" }) {
  const accent = accents[item.category.slug] || "from-slate-800 via-violet-700 to-indigo-600";
  const practice = variant === "practice" || item.assessmentPurpose === "practice";
  const title = practice ? item.title : certificationDisplayTitle(item.title);
  const href = item.canonicalPath || (practice ? publicPracticePath(item.slug) : publicAssessmentPath(item.slug));

  return (
    <article className={`group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl ${practice ? "border border-violet-200 shadow-[0_12px_40px_-24px_rgba(109,40,217,0.7)] hover:border-violet-300 hover:shadow-violet-900/15" : "border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-slate-900/10"}`}>
      {practice && <div aria-hidden className="absolute inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-amber-300 via-violet-500 to-cyan-400" />}
      <Link href={href} className={`relative block min-h-40 overflow-hidden bg-gradient-to-br ${accent} p-5 text-white`}>
        {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity transition duration-500 group-hover:scale-105" />}
        <div aria-hidden className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[24px] border-white/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] backdrop-blur-sm"><Award className="h-3 w-3" />{practice ? "Skill practice" : "Octamy certified"}</span>
            {practice ? <span className="rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-100 to-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-950 shadow-sm">Practice Pass</span> : item.subscriptionEligible && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">Sponsored</span>}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">{item.category.name}</p>
            <h2 className="mt-2 line-clamp-3 text-xl font-black leading-tight tracking-[-0.025em]">{title}</h2>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          {categoryHref ? <Link href={categoryHref}><Badge variant="outline" className="rounded-full hover:border-violet-300 hover:text-violet-800">{item.category.name}</Badge></Link> : <Badge variant="outline" className="rounded-full">{item.category.name}</Badge>}
          <Badge variant="outline" className="rounded-full">{levelLabels[item.level] || item.level}</Badge>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.description}</p>
        {item.audienceBands?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.audienceBands.slice(0, 2).map((band) => <span key={band.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{band.label}</span>)}</div> : null}

        <div className="mt-5 grid grid-cols-2 gap-2 border-y border-slate-100 py-3 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-violet-600" />{item.duration} min</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />Pass at {item.passingScore}%</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className={`flex items-center gap-1 text-xs font-bold ${practice ? "text-violet-800" : "text-emerald-700"}`}><Sparkles className="h-3.5 w-3.5" />{practice ? "Unlimited with Practice Pass" : "Exam attempt is free"}</p>
            <p className="mt-1 text-xs text-slate-500">{practice ? "₹299/month · Learn and improve" : `Credential activation ₹${item.price}`}</p>
          </div>
          <Button asChild size="sm" className="rounded-full px-4">
            <Link href={href} aria-label={`View ${title}`}>{practice ? "Practice" : "View"} <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
