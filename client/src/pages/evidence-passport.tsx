import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  Globe2,
  Linkedin,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';

type EvidenceStatus = 'active' | 'expired' | 'revoked' | 'pending_activation';

interface EvidencePassportData {
  holder: {
    name: string;
    currentRole?: string;
    location?: string;
    bio?: string;
    selfReportedSkills: string[];
    workType: string[];
    portfolioUrl?: string;
    linkedinProfile?: string;
  };
  summary: {
    activeEvidenceCount: number;
    totalEvidenceCount: number;
    averageScore: number | null;
    lastIssuedAt: string | null;
  };
  evidence: Array<{
    certificateId: string;
    courseTitle: string;
    score: number;
    badge: string;
    issuedAt: string;
    expiresAt: string;
    issuedBy: string;
    status: EvidenceStatus;
    assessment: {
      completedAt?: string;
      questionCount?: number;
      durationSeconds?: number;
      passingScore?: number;
      level?: string;
    };
  }>;
  generatedAt: string;
}

const statusStyles: Record<EvidenceStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  expired: 'border-amber-200 bg-amber-50 text-amber-800',
  revoked: 'border-rose-200 bg-rose-50 text-rose-700',
  pending_activation: 'border-slate-200 bg-slate-100 text-slate-600',
};

function labelStatus(status: EvidenceStatus) {
  return status === 'pending_activation' ? 'Pending activation' : status[0].toUpperCase() + status.slice(1);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 1) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min recorded`;
}

export default function EvidencePassport() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useQuery<EvidencePassportData>({
    queryKey: [`/api/evidence/${token}`],
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <SEO
        title={data ? `${data.holder.name}'s Skill Evidence Passport` : 'Skill Evidence Passport'}
        description="A learner-controlled Octamy record of scored assessments and publicly verifiable credentials."
        path={token ? `/evidence/${token}` : '/evidence'}
        noIndex
      />
      <Header />

      <main id="main-content">
        {isLoading ? (
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              <div className="h-72 animate-pulse rounded-2xl bg-slate-200 lg:col-span-2" />
              <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
            </div>
          </div>
        ) : error || !data ? (
          <section className="mx-auto flex min-h-[65vh] max-w-2xl items-center px-4 py-16 text-center">
            <div className="w-full rounded-[2rem] border-2 border-slate-900 bg-white p-8 shadow-[8px_8px_0_0_rgba(15,23,42,0.9)] sm:p-12">
              <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Evidence passport unavailable</h1>
              <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">
                This link is invalid, or the learner has made their profile private. Octamy does not expose private profile details.
              </p>
              <Button asChild className="mt-7 rounded-full bg-slate-950 px-6 text-white hover:bg-black">
                <Link href="/verify">Verify a credential instead <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
              <div aria-hidden className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div aria-hidden className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
              <div aria-hidden className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:42px_42px]" />

              <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
                <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
                  <div className="max-w-3xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
                      <ShieldCheck className="h-3.5 w-3.5" /> Skill Evidence Passport
                    </span>
                    <h1 className="mt-6 text-4xl font-extrabold tracking-[-0.045em] sm:text-6xl">{data.holder.name}</h1>
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
                      {data.holder.currentRole && <span>{data.holder.currentRole}</span>}
                      {data.holder.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{data.holder.location}</span>}
                    </div>
                    {data.holder.bio && <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{data.holder.bio}</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { value: data.summary.activeEvidenceCount, label: 'Active evidence' },
                      { value: data.summary.averageScore ?? '—', suffix: data.summary.averageScore === null ? '' : '%', label: 'Average score' },
                      { value: data.summary.lastIssuedAt ? formatDate(data.summary.lastIssuedAt) : '—', label: 'Latest evidence', small: true },
                    ].map((item) => (
                      <div key={item.label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 backdrop-blur sm:min-w-28 sm:px-4">
                        <p className={`${item.small ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl'} truncate font-extrabold`}>{item.value}{item.suffix}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-wide text-slate-400 sm:text-[10px]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-700">Assessment-backed records</p>
                  <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Evidence an employer can inspect</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Scores below come from recorded Octamy assessment attempts. Status is checked against the live credential record.</p>
                </div>

                {data.evidence.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
                    <Award className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-4 font-bold">No activated evidence yet</h3>
                    <p className="mt-2 text-sm text-slate-500">This learner has not shared an activated Octamy credential.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.evidence.map((record) => (
                      <article key={record.certificateId} className="overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[5px_5px_0_0_rgba(15,23,42,0.9)]">
                        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles[record.status]}`}>{labelStatus(record.status)}</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{record.badge} tier</span>
                            </div>
                            <h3 className="mt-3 text-xl font-extrabold text-slate-950">{record.courseTitle}</h3>
                            <p className="mt-1 text-xs text-slate-500">Issued by {record.issuedBy}</p>
                          </div>
                          <div className="shrink-0 rounded-xl bg-slate-950 px-5 py-3 text-center text-white">
                            <p className="text-3xl font-extrabold">{record.score}%</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Assessment score</p>
                          </div>
                        </div>

                        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600 sm:grid-cols-4 sm:px-6">
                          <span className="inline-flex items-center gap-1.5"><FileCheck2 className="h-4 w-4 text-slate-400" />Pass mark {record.assessment.passingScore ?? '—'}%</span>
                          <span className="inline-flex items-center gap-1.5"><Award className="h-4 w-4 text-slate-400" />{record.assessment.questionCount ?? '—'} questions</span>
                          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-slate-400" />{formatDuration(record.assessment.durationSeconds) ?? 'Duration unavailable'}</span>
                          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-slate-400" />Issued {formatDate(record.issuedAt)}</span>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                          <code className="truncate text-[11px] text-slate-500">{record.certificateId}</code>
                          <Link href={`/verify?certificate=${encodeURIComponent(record.certificateId)}`} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-900 hover:underline">
                            Open live verification <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="font-extrabold">How to read this passport</h2>
                  <div className="mt-4 space-y-4 text-xs leading-5 text-slate-600">
                    <p className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span><strong className="text-slate-900">Assessment-backed</strong><br />Scores originate from an Octamy attempt, not a profile claim.</span></p>
                    <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /><span><strong className="text-slate-900">Live status</strong><br />Each ID can be checked for activation, expiry or revocation.</span></p>
                    <p className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><strong className="text-slate-900">Not an identity check</strong><br />Octamy has not independently verified this person's government identity.</span></p>
                  </div>
                </div>

                {data.holder.selfReportedSkills.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-extrabold">Profile skills</h2>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Self-reported</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {data.holder.selfReportedSkills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{skill}</span>)}
                    </div>
                  </div>
                )}

                {(data.holder.portfolioUrl || data.holder.linkedinProfile) && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-extrabold">Candidate links</h2>
                    <div className="mt-3 space-y-2 text-sm">
                      {data.holder.portfolioUrl && <a href={data.holder.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold text-slate-700 hover:text-slate-950"><Globe2 className="h-4 w-4" /> Portfolio <ExternalLink className="ml-auto h-3.5 w-3.5" /></a>}
                      {data.holder.linkedinProfile && <a href={data.holder.linkedinProfile} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold text-slate-700 hover:text-slate-950"><Linkedin className="h-4 w-4" /> LinkedIn <ExternalLink className="ml-auto h-3.5 w-3.5" /></a>}
                    </div>
                  </div>
                )}
              </aside>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
