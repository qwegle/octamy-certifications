import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock3, Eye, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const CONSENT_VERSION = "candidate-evidence-consent.v1";
const MAX_EVIDENCE_ITEMS = 50;

type RecruiterOption = { id: number; companyName: string; industry?: string | null; interactionAt: string };
type CertificationOption = { id: number; certificateId: string; courseTitle: string; score: number; badge: string; expiresAt: string };
type PracticeOption = { id: number; courseTitle: string; score: number; completedAt: string };
type EvidenceOptions = { certifications: CertificationOption[]; practiceSummaries: PracticeOption[] };
type Grant = {
  id: string;
  targetRecruiterId: number;
  recruiterCompany: string;
  purpose: string;
  jobReference: string | null;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  version: number;
  status: "active" | "expired" | "revoked";
  selectedEvidence: { certifications: CertificationOption[]; practiceSummaries: PracticeOption[] };
};
type AccessEvent = {
  id: number;
  grantId: string;
  recruiterCompany: string;
  scopes: string[];
  selectedCertificateIds: number[];
  selectedPracticeSummaryIds: number[];
  occurredAt: string;
};

async function getJson<T>(path: string): Promise<T> {
  return (await apiRequest("GET", path)).json();
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function QueryFailure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>Could not load this private data</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        <Button type="button" size="sm" variant="outline" onClick={retry}>Try again</Button>
      </AlertDescription>
    </Alert>
  );
}

export default function EvidenceSharing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [targetRecruiterId, setTargetRecruiterId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [jobReference, setJobReference] = useState("");
  const [expiresOn, setExpiresOn] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [certificateIds, setCertificateIds] = useState<Set<number>>(new Set());
  const [practiceSummaryIds, setPracticeSummaryIds] = useState<Set<number>>(new Set());
  const [consented, setConsented] = useState(false);

  const recruitersQuery = useQuery<{ recruiters: RecruiterOption[] }>({
    queryKey: ["/api/user/evidence-grants/eligible-recruiters"],
    queryFn: () => getJson("/api/user/evidence-grants/eligible-recruiters"),
  });
  const optionsQuery = useQuery<EvidenceOptions>({
    queryKey: ["/api/user/evidence-grants/options"],
    queryFn: () => getJson("/api/user/evidence-grants/options"),
  });
  const grantsQuery = useQuery<{ grants: Grant[] }>({
    queryKey: ["/api/user/evidence-grants"],
    queryFn: () => getJson("/api/user/evidence-grants"),
  });
  const historyQuery = useQuery<{ events: AccessEvent[] }>({
    queryKey: ["/api/user/evidence-grants/access-history"],
    queryFn: () => getJson("/api/user/evidence-grants/access-history"),
  });

  const grants = grantsQuery.data?.grants || [];
  const activeGrants = useMemo(() => grants.filter((grant) => grant.status === "active"), [grants]);
  const pastGrants = useMemo(() => grants.filter((grant) => grant.status !== "active"), [grants]);
  const selectedCount = certificateIds.size + practiceSummaryIds.size;
  const toggle = (setter: Dispatch<SetStateAction<Set<number>>>, id: number, checked: boolean) => {
    setter((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const createGrant = useMutation({
    mutationFn: async () => {
      const requestedExpiry = new Date(`${expiresOn}T23:59:59.000Z`).getTime();
      const maxExpiry = Date.now() + 30 * 86_400_000;
      const expiresAt = new Date(Math.min(requestedExpiry, maxExpiry)).toISOString();
      const response = await apiRequest("POST", "/api/user/evidence-grants", {
        targetRecruiterId: Number(targetRecruiterId),
        purpose: purpose.trim(),
        jobReference: jobReference.trim() || undefined,
        certificateIds: Array.from(certificateIds),
        practiceSummaryIds: Array.from(practiceSummaryIds),
        consentVersion: CONSENT_VERSION,
        expiresAt,
      });
      return response.json();
    },
    onSuccess: async () => {
      setPurpose("");
      setJobReference("");
      setCertificateIds(new Set());
      setPracticeSummaryIds(new Set());
      setConsented(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/user/evidence-grants"] });
      toast({ title: "Evidence grant created", description: "Only the selected recruiter can view the selected summaries until expiry or revocation." });
    },
    onError: (error: Error) => toast({ title: "Grant could not be created", description: error.message, variant: "destructive" }),
  });

  const revokeGrant = useMutation({
    mutationFn: async (grant: Grant) => {
      const response = await apiRequest("POST", `/api/user/evidence-grants/${encodeURIComponent(grant.id)}/revoke`, {
        version: grant.version,
        reason: "Revoked by learner",
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user/evidence-grants"] });
      toast({ title: "Evidence access revoked", description: "The recruiter can no longer load this grant." });
    },
    onError: (error: Error) => toast({ title: "Grant could not be revoked", description: error.message, variant: "destructive" }),
  });

  const canCreate = Boolean(
    targetRecruiterId
    && purpose.trim().length >= 3
    && expiresOn
    && certificateIds.size > 0
    && selectedCount <= MAX_EVIDENCE_ITEMS
    && consented
    && !createGrant.isPending,
  );

  return (
    <DashboardLayout role="learner" title="Recruiter evidence sharing" description="Choose exactly which evidence one verified recruiter may inspect, for a limited purpose and time.">
      <main className="space-y-6" aria-busy={recruitersQuery.isLoading || optionsQuery.isLoading || grantsQuery.isLoading || historyQuery.isLoading}>
        <Button asChild variant="ghost"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to dashboard</Link></Button>
        <Alert className="border-sky-200 bg-sky-50 text-sky-950">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Discovery is not evidence consent</AlertTitle>
          <AlertDescription>Profile visibility and recruiter credits do not disclose activity. A grant below is recruiter-specific, purpose-bound, expires automatically, and can be revoked. Answers, questions, hidden tests, IP addresses, user agents, raw integrity events, recordings, transcripts, global activity, and Interview Studio data are never shared.</AlertDescription>
        </Alert>

        {(recruitersQuery.isError || optionsQuery.isError) && (
          <QueryFailure
            message="Recruiter or selectable-evidence options are unavailable. Nothing has been shared."
            retry={() => { void recruitersQuery.refetch(); void optionsQuery.refetch(); }}
          />
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
          <Card className="border-slate-200">
            <CardHeader><CardTitle>Create a selected evidence grant</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="grant-recruiter">Verified recruiter</Label>
                <Select value={targetRecruiterId} onValueChange={setTargetRecruiterId} disabled={recruitersQuery.isLoading || recruitersQuery.isError}>
                  <SelectTrigger id="grant-recruiter" className="mt-2" aria-describedby="grant-recruiter-help"><SelectValue placeholder={recruitersQuery.isLoading ? "Loading verified recruiters…" : "Choose a recruiter who viewed your profile"} /></SelectTrigger>
                  <SelectContent>{(recruitersQuery.data?.recruiters || []).map((recruiter) => <SelectItem key={recruiter.id} value={String(recruiter.id)}>{recruiter.companyName}{recruiter.industry ? ` · ${recruiter.industry}` : ""}</SelectItem>)}</SelectContent>
                </Select>
                <p id="grant-recruiter-help" className="mt-2 text-xs text-slate-500">Only active, KYC-approved recruiters with an exact profile-view interaction are eligible.</p>
                {!recruitersQuery.isLoading && !recruitersQuery.isError && !(recruitersQuery.data?.recruiters.length) && <p className="mt-2 text-sm text-slate-500" role="status">No eligible recruiter interaction exists yet.</p>}
              </div>
              <div><Label htmlFor="grant-purpose">Purpose</Label><Textarea id="grant-purpose" className="mt-2" minLength={3} maxLength={500} required value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="For example: Senior frontend engineer application" aria-describedby="grant-purpose-help" /><p id="grant-purpose-help" className="mt-1 text-xs text-slate-500">The recruiter sees this immutable purpose with the selected evidence.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="grant-job">Job reference (optional)</Label><Input id="grant-job" className="mt-2" maxLength={200} value={jobReference} onChange={(event) => setJobReference(event.target.value)} /></div>
                <div><Label htmlFor="grant-expiry">Expires on</Label><Input id="grant-expiry" className="mt-2" type="date" required min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} max={new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></div>
              </div>

              <fieldset disabled={optionsQuery.isLoading || optionsQuery.isError}>
                <legend className="text-sm font-semibold">Certification evidence (select at least one)</legend>
                <div className="mt-3 space-y-2">
                  {optionsQuery.isLoading && <p className="text-sm text-slate-500" role="status">Loading eligible certifications…</p>}
                  {(optionsQuery.data?.certifications || []).map((item) => {
                    const inputId = `grant-certificate-${item.id}`;
                    return <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><Checkbox id={inputId} checked={certificateIds.has(item.id)} onCheckedChange={(value) => toggle(setCertificateIds, item.id, value === true)} /><Label htmlFor={inputId} className="cursor-pointer font-normal"><span className="block text-sm font-medium">{item.courseTitle} · {item.score}%</span><span className="block text-xs text-slate-500">Active until {dateLabel(item.expiresAt)}</span></Label></div>;
                  })}
                  {!optionsQuery.isLoading && !optionsQuery.isError && !(optionsQuery.data?.certifications.length) && <p className="text-sm text-slate-500" role="status">No active paid certification credentials are eligible.</p>}
                </div>
              </fieldset>

              <fieldset disabled={optionsQuery.isLoading || optionsQuery.isError}>
                <legend className="text-sm font-semibold">Practice summaries (optional)</legend>
                <p className="mt-1 text-xs text-slate-500">Only approved practice-assessment summaries are available—not answers, questions, integrity events, or Interview Studio.</p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {(optionsQuery.data?.practiceSummaries || []).map((item) => {
                    const inputId = `grant-practice-${item.id}`;
                    return <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><Checkbox id={inputId} checked={practiceSummaryIds.has(item.id)} onCheckedChange={(value) => toggle(setPracticeSummaryIds, item.id, value === true)} /><Label htmlFor={inputId} className="cursor-pointer font-normal"><span className="block text-sm font-medium">{item.courseTitle} · {item.score}%</span><span className="block text-xs text-slate-500">Completed {dateLabel(item.completedAt)}</span></Label></div>;
                  })}
                  {!optionsQuery.isLoading && !optionsQuery.isError && !(optionsQuery.data?.practiceSummaries.length) && <p className="text-sm text-slate-500">No approved practice summaries are eligible.</p>}
                </div>
              </fieldset>

              <p className={selectedCount > MAX_EVIDENCE_ITEMS ? "text-sm font-medium text-red-700" : "text-xs text-slate-500"} role="status">{selectedCount} of {MAX_EVIDENCE_ITEMS} evidence items selected.</p>
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><Checkbox id="grant-consent" checked={consented} onCheckedChange={(value) => setConsented(value === true)} /><Label htmlFor="grant-consent" className="cursor-pointer font-normal text-sm text-emerald-950"><strong className="block">I authorize this exact disclosure</strong>I understand the selected recruiter, purpose, evidence, expiry, and immediate revocation behavior described above.</Label></div>
              <Button className="w-full" disabled={!canCreate} onClick={() => createGrant.mutate()} aria-busy={createGrant.isPending}>{createGrant.isPending ? "Creating grant…" : "Create expiring grant"}</Button>
              <div className="sr-only" aria-live="polite">{createGrant.isPending ? "Creating evidence grant" : ""}</div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {grantsQuery.isError && <QueryFailure message="Your evidence grants could not be loaded." retry={() => { void grantsQuery.refetch(); }} />}
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="flex items-center gap-2"><UserRoundCheck className="h-5 w-5" aria-hidden="true" />Active grants ({activeGrants.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {grantsQuery.isLoading && <p className="text-sm text-slate-500" role="status">Loading active grants…</p>}
                {!grantsQuery.isLoading && !grantsQuery.isError && (activeGrants.length ? activeGrants.map((grant) => {
                  const revoking = revokeGrant.isPending && revokeGrant.variables?.id === grant.id;
                  return <article key={grant.id} className="rounded-xl border border-slate-200 p-4" aria-labelledby={`grant-${grant.id}`}><div className="flex items-start justify-between gap-3"><div><h3 id={`grant-${grant.id}`} className="font-semibold">{grant.recruiterCompany}</h3><p className="mt-1 text-sm text-slate-600">{grant.purpose}</p>{grant.jobReference && <p className="mt-1 text-xs text-slate-500">Job reference: {grant.jobReference}</p>}</div><Badge>Active</Badge></div><p className="mt-3 text-xs text-slate-500">Expires {dateLabel(grant.expiresAt)} · {grant.selectedEvidence.certifications.length} certification(s) · {grant.selectedEvidence.practiceSummaries.length} practice summary(s)</p><Button className="mt-3" size="sm" variant="destructive" disabled={revokeGrant.isPending} aria-busy={revoking} onClick={() => revokeGrant.mutate(grant)}>{revoking ? "Revoking…" : "Revoke now"}</Button></article>;
                }) : <p className="text-sm text-slate-500">No active recruiter evidence grants.</p>)}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" aria-hidden="true" />Grant history</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!grantsQuery.isLoading && !grantsQuery.isError && (pastGrants.length ? pastGrants.map((grant) => <article key={grant.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{grant.recruiterCompany}</p><p className="mt-1 text-xs text-slate-600">{grant.purpose}</p></div><Badge variant="secondary">{grant.status === "revoked" ? "Revoked" : "Expired"}</Badge></div><p className="mt-2 text-xs text-slate-500">Granted {dateLabel(grant.grantedAt)}{grant.revokedAt ? ` · Revoked ${dateLabel(grant.revokedAt)}` : ` · Expired ${dateLabel(grant.expiresAt)}`}</p></article>) : <p className="text-sm text-slate-500">No revoked or expired grants.</p>)}
              </CardContent>
            </Card>

            {historyQuery.isError && <QueryFailure message="Recruiter disclosure history could not be loaded." retry={() => { void historyQuery.refetch(); }} />}
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" aria-hidden="true" />Access history</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {historyQuery.isLoading && <p className="text-sm text-slate-500" role="status">Loading append-only access history…</p>}
                {!historyQuery.isLoading && !historyQuery.isError && ((historyQuery.data?.events || []).length ? historyQuery.data!.events.map((event) => <article key={event.id} className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />{event.recruiterCompany} viewed selected evidence</p><p className="mt-1 text-xs text-slate-500">{dateLabel(event.occurredAt)} · {event.selectedCertificateIds.length} certification(s) · {event.selectedPracticeSummaryIds.length} practice summary(s)</p></article>) : <p className="text-sm text-slate-500">No recruiter has accessed a selected evidence grant yet.</p>)}
              </CardContent>
            </Card>

            <Card className="border-slate-200"><CardContent className="flex gap-3 p-4"><LockKeyhole className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden="true" /><div><p className="text-sm font-semibold">Automatic expiry and immediate revocation</p><p className="mt-1 text-xs leading-5 text-slate-500">Every recruiter read revalidates the exact recruiter, learner, purpose-bound grant, and current selected evidence. Revocation or expiry prevents subsequent reads, disclosure is serialized with revocation, and stale caching is disabled.</p></div></CardContent></Card>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
