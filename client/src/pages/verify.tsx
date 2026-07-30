import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type CredentialStatus = 'active' | 'expired' | 'revoked' | 'pending_activation';

interface VerificationResponse {
  authentic: boolean;
  valid: boolean;
  status: CredentialStatus;
  certificateId: string;
  userName: string;
  courseTitle: string;
  score: number;
  badge: string;
  issuedAt: string;
  expiresAt: string;
  issuedBy: string;
  issuer?: {
    platform?: string;
    coIssuer?: { name: string; logoUrl?: string | null } | null;
  };
  assessment: {
    passingScore?: number;
    questionCount?: number;
    durationSeconds?: number;
    completedAt?: string;
    level?: string;
  };
}

const statusContent: Record<CredentialStatus, { title: string; description: string; shell: string; icon: typeof CheckCircle2 }> = {
  active: {
    title: 'Credential active',
    description: 'This record exists, is activated and is within its validity period.',
    shell: 'border-slate-300 bg-slate-50 text-slate-800',
    icon: CheckCircle2,
  },
  expired: {
    title: 'Credential expired',
    description: 'The record is authentic, but its validity period has ended.',
    shell: 'border-slate-300 bg-slate-50 text-slate-900',
    icon: AlertTriangle,
  },
  revoked: {
    title: 'Credential revoked',
    description: 'The record exists, but Octamy no longer considers it valid.',
    shell: 'border-slate-300 bg-slate-50 text-slate-800',
    icon: XCircle,
  },
  pending_activation: {
    title: 'Not activated',
    description: 'An assessment record exists, but the credential has not been activated.',
    shell: 'border-slate-300 bg-slate-100 text-slate-700',
    icon: FileCheck2,
  },
};

function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 1) return 'Unavailable';
  return `${Math.max(1, Math.round(seconds / 60))} minutes`;
}

export default function Verify() {
  const params = useParams<{ certificateId?: string }>();
  const { toast } = useToast();
  const [certificateId, setCertificateId] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  useEffect(() => {
    const queryId = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('certificate') || '';
    const initial = params.certificateId || queryId;
    if (initial) {
      setCertificateId(initial);
      setSubmittedId(initial);
    }
  }, [params.certificateId]);

  const { data, isLoading, error } = useQuery<VerificationResponse>({
    queryKey: [`/api/certificates/verify/${encodeURIComponent(submittedId)}`],
    enabled: submittedId.length > 0,
    retry: false,
  });

  const handleSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalized = certificateId.trim();
    if (normalized) setSubmittedId(normalized);
  };

  const copyVerificationLink = async () => {
    if (!data) return;
    const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(data.certificateId)}`;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      toast({ title: 'Verification link copied', description: 'The link opens this credential’s live status and recorded evidence.' });
    } catch (copyError) {
      console.error('Verification link copy failed:', copyError);
      toast({
        title: 'Link could not be copied',
        description: 'Copy the address from your browser and try again.',
        variant: 'destructive',
      });
    }
  };

  const status = data ? statusContent[data.status] : null;
  const StatusIcon = status?.icon;
  const errorMessage = error instanceof Error ? error.message : '';
  const recordNotFound = /not found/i.test(errorMessage);

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <SEO title="Verify a credential" description="Check an Octamy credential's assessment evidence and current activation, expiry or revocation status." path="/verify" />
      <Header />

      <main id="main-content">
        <section className="border-b border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Octamy</Link>
            <div className="mt-7 grid items-end gap-8 lg:grid-cols-[1fr_420px]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/25 bg-slate-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-200"><ShieldCheck className="h-3.5 w-3.5" /> Live evidence check</span>
                <h1 className="mt-5 text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">Verify what the credential actually proves.</h1>
                <p className="mt-4 max-w-2xl leading-7 text-slate-300">Inspect the assessment score, pass mark, issuer and current record status—not just a certificate image.</p>
              </div>

              <form onSubmit={handleSearch} className="rounded-2xl border border-white/15 bg-white/[0.07] p-3 shadow-2xl shadow-black/20 backdrop-blur">
                <label htmlFor="certificate-id" className="sr-only">Certificate ID</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="certificate-id" value={certificateId} onChange={(event) => setCertificateId(event.target.value)} placeholder="Enter credential ID" autoComplete="off" autoCapitalize="off" spellCheck={false} aria-describedby="certificate-id-help" className="h-12 rounded-xl border-white/15 bg-white pl-10 text-slate-950" />
                  </div>
                  <Button type="submit" disabled={!certificateId.trim() || isLoading} className="h-12 rounded-xl bg-slate-300 px-6 font-bold text-slate-950 hover:bg-slate-200">{isLoading ? 'Checking…' : 'Check record'}</Button>
                </div>
                <p id="certificate-id-help" className="mt-2 px-1 text-[11px] leading-5 text-slate-400">Use the complete ID shown on the credential. The check is public and does not require sign-in.</p>
              </form>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14" aria-live="polite">
          {!submittedId && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: FileCheck2, title: 'Authenticity', body: 'Does this ID exist in Octamy records?' },
                { icon: Award, title: 'Assessment evidence', body: 'What score and pass threshold were recorded?' },
                { icon: ShieldCheck, title: 'Current status', body: 'Is it active, expired, revoked or unactivated?' },
              ].map((item) => <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><item.icon className="h-5 w-5 text-slate-700" /><h2 className="mt-5 font-extrabold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p></div>)}
            </div>
          )}

          {isLoading && <div className="h-96 animate-pulse rounded-3xl bg-slate-200" aria-label="Checking credential record" />}

          {error && !isLoading && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_28px_80px_-48px_rgba(15,23,42,.5)] sm:p-12">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><XCircle className="h-7 w-7" /></span>
              <h2 className="mt-5 text-3xl font-extrabold">{recordNotFound ? 'Record not found' : 'Verification is temporarily unavailable'}</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{recordNotFound ? <>No Octamy credential matches “{submittedId}”. Check the ID exactly as issued. A certificate image without a matching live record should not be trusted.</> : 'The live record could not be checked right now. No conclusion should be drawn about the credential until the service responds.'}</p>
              <Button type="button" variant="outline" onClick={() => { setSubmittedId(''); setCertificateId(''); }} className="mt-6 rounded-xl">Check another ID</Button>
            </div>
          )}

          {data && status && StatusIcon && !isLoading && (
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_90px_-50px_rgba(15,23,42,.55)]">
              <div className={`flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 ${status.shell}`}>
                <div className="flex items-start gap-4">
                  <StatusIcon className="mt-0.5 h-9 w-9 shrink-0" />
                  <div><h2 className="text-2xl font-extrabold">{status.title}</h2><p className="mt-1 text-sm">{status.description}</p></div>
                </div>
                <span className="w-fit rounded-full border border-current/20 bg-white/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]">{data.valid ? 'Currently valid' : 'Not currently valid'}</span>
              </div>

              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_210px]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Assessment-backed credential</p>
                  <h3 className="mt-2 text-3xl font-extrabold tracking-tight">{data.courseTitle}</h3>
                  <div className="mt-7 grid gap-5 sm:grid-cols-2">
                    {[
                      { icon: User, label: 'Account holder', value: data.userName },
                      { icon: BookOpen, label: 'Assessment level', value: data.assessment?.level || 'Not specified' },
                      { icon: CalendarDays, label: 'Issued', value: formatDate(data.issuedAt) },
                      { icon: CalendarDays, label: 'Valid until', value: formatDate(data.expiresAt) },
                      { icon: FileCheck2, label: 'Questions recorded', value: data.assessment?.questionCount ?? 'Unavailable' },
                      { icon: Clock3, label: 'Duration recorded', value: formatDuration(data.assessment?.durationSeconds) },
                    ].map((item) => <div key={item.label} className="flex gap-3"><item.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div><p className="text-xs text-slate-500">{item.label}</p><p className="mt-0.5 text-sm font-bold text-slate-900">{item.value}</p></div></div>)}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-950 p-5 text-center text-white">
                  <p className="text-5xl font-extrabold">{data.score}%</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Recorded score</p>
                  <div className="my-5 h-px bg-white/10" />
                  <p className="text-sm font-bold">Pass mark {data.assessment?.passingScore ?? '—'}%</p>
                  <p className="mt-2 text-xs text-slate-400">{data.badge} performance tier</p>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white"><ShieldCheck className="h-4 w-4" /></span>
                    <div><p className="text-xs text-slate-500">Platform issuer</p><p className="mt-1 text-sm font-bold">{data.issuer?.platform || data.issuedBy}</p></div>
                  </div>
                  {data.issuer?.coIssuer && (
                    <div className="flex items-start gap-3">
                      {data.issuer.coIssuer.logoUrl ? <img src={data.issuer.coIssuer.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600"><Building2 className="h-4 w-4" /></span>}
                      <div><p className="text-xs text-slate-500">Verified institute co-issuer</p><p className="mt-1 text-sm font-bold">{data.issuer.coIssuer.name}</p></div>
                    </div>
                  )}
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">{data.certificateId}</code>
                  <Button type="button" variant="outline" onClick={copyVerificationLink} className="rounded-xl bg-white"><Copy className="mr-2 h-4 w-4" />Copy link</Button>
                  <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"><Link href={`/certificate/${encodeURIComponent(data.certificateId)}`}><ExternalLink className="mr-2 h-4 w-4" />Open record</Link></Button>
                </div>
                <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-900"><strong>Evidence boundary:</strong> This verifies an Octamy account's recorded assessment result and credential status. It is not government-ID verification, a degree, a professional licence or a guarantee of job performance.</p>
              </div>
            </article>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
