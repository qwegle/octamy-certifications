import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Activity, CheckCircle2, Clock3, Download, Eye, MonitorUp, Network, Percent, Search, ShieldCheck, Users, WifiOff } from "lucide-react";

type ResultPayload = {
  exam: { id: number; title: string; status: string; passingScore: number; startsAt: string | null; endsAt: string | null };
  summary: { total: number; completed: number; inProgress: number; passed: number; failed: number; timedOut: number; passRate: number; averageScore: number };
  attempts: Array<{
    id: number;
    user_id: number | null;
    email: string | null;
    name: string | null;
    started_at: string;
    last_heartbeat_at: string;
    submitted_at: string | null;
    score: number;
    total_points: number;
    total_questions: number;
    score_pct: string | number;
    passed: boolean;
    status: string;
    duration_sec: number;
  }>;
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

type EvidenceAttempt = {
  id: number;
  email: string | null;
  started_at: string;
  last_heartbeat_at: string;
  last_autosave_at: string | null;
  submitted_at: string | null;
  status: string;
  proctor_mode: "standard" | "browser_evidence";
  evidence_consent_at: string | null;
  visibility_hidden_count: number;
  window_blur_count: number;
  fullscreen_exit_count: number;
  paste_count: number;
  network_interruption_count: number;
  disconnected_seconds: number;
};

type EvidencePayload = {
  exam: { id: number; title: string; passingScore: number; proctorMode: string };
  attempts: EvidenceAttempt[];
  evidenceBoundary: string;
};

type EvidenceDetailPayload = {
  attempt: {
    id: number;
    email: string | null;
    startedAt: string;
    lastHeartbeatAt: string;
    lastAutosaveAt: string | null;
    submittedAt: string | null;
    status: string;
    proctorMode: "standard" | "browser_evidence";
    evidenceConsentAt: string | null;
    evidenceConsentVersion: string | null;
  };
  events: Array<{
    id: number;
    eventType: string;
    clientAt: string | null;
    occurredAt: string;
    metadata: { durationMs?: number; reason?: string } | null;
  }>;
  evidenceBoundary: Record<string, boolean>;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export default function InstituteExamResults() {
  const [, params] = useRoute<{ id: string }>("/institute/exams/:id/results");
  const examId = Number(params?.id);
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState<"results" | "evidence">("results");
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const query = useQuery<ResultPayload>({
    queryKey: ["/api/exam-instances", examId, "results", { page, status, search }],
    enabled: !!user && !!token && Number.isInteger(examId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const query = new URLSearchParams({ page: String(page), pageSize: "50", status, search });
      const response = await apiRequest("GET", `/api/exam-instances/${examId}/results?${query}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Results could not be loaded");
      return response.json();
    },
  });

  const evidenceQuery = useQuery<EvidencePayload>({
    queryKey: ["/api/exam-instances", examId, "attempt-evidence"],
    enabled: !!user && !!token && Number.isInteger(examId) && view === "evidence",
    queryFn: async () => (await apiRequest("GET", `/api/exam-instances/${examId}/attempts`)).json(),
  });

  const detailQuery = useQuery<EvidenceDetailPayload>({
    queryKey: ["/api/exam-instances", examId, "attempt-evidence", selectedAttemptId],
    enabled: !!selectedAttemptId && view === "evidence",
    queryFn: async () => (
      await apiRequest("GET", `/api/exam-instances/${examId}/attempts/${selectedAttemptId}`)
    ).json(),
  });

  const exportCsv = async () => {
    try {
      const query = new URLSearchParams({ status, search });
      const response = await apiRequest("GET", `/api/exam-instances/${examId}/results/export?${query}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `exam-${examId}-results.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Results exported", description: "The CSV contains all attempts matching the current filters." });
    } catch (error: any) {
      toast({ title: "Export unavailable", description: error.message });
    }
  };

  if (!user) return null;
  const data = query.data;

  return (
    <DashboardLayout
      role="institute"
      title={data?.exam.title || "Exam results"}
      description="Assessment scoring and proportionate browser evidence, kept separate for fair review."
      breadcrumbs={[{ label: "Exams", href: "/institute/exams" }, { label: "Results" }]}
      actions={<Button variant="outline" onClick={exportCsv} disabled={!data?.summary.total}><Download className="mr-2 h-4 w-4" /> Export all CSV</Button>}
    >
      <SEO title={`${data?.exam.title || "Exam"} results`} description="Institute exam results." path={`/institute/exams/${examId}/results`} />

      <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <Button size="sm" variant={view === "results" ? "default" : "ghost"} onClick={() => setView("results")}>Results</Button>
        <Button size="sm" variant={view === "evidence" ? "default" : "ghost"} onClick={() => setView("evidence")}>Evidence review</Button>
      </div>

      {view === "results" ? (query.error ? (
        <Card className="border-slate-200 bg-slate-50/70"><CardContent className="p-4 text-sm text-slate-950">{(query.error as Error).message}</CardContent></Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat icon={<Users className="h-5 w-5" />} label="Attempts" value={data?.summary.total ?? 0} />
            <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Completed" value={data?.summary.completed ?? 0} />
            <Stat icon={<Percent className="h-5 w-5" />} label="Pass rate" value={`${data?.summary.passRate ?? 0}%`} />
            <Stat icon={<Percent className="h-5 w-5" />} label="Average score" value={`${data?.summary.averageScore ?? 0}%`} />
            <Stat icon={<Clock3 className="h-5 w-5" />} label="In progress" value={data?.summary.inProgress ?? 0} />
          </div>

          <Card>
            <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle className="text-base">Candidate attempts</CardTitle><p className="mt-1 text-xs text-slate-500">Scores are calculated from this exam's deterministic question set.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <form className="relative" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9 sm:w-64" placeholder="Search name or email" />
                </form>
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="all">All statuses</option><option value="submitted">Submitted</option><option value="in_progress">In progress</option><option value="timed_out">Timed out</option><option value="abandoned">Abandoned</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {query.isLoading ? (
                <div className="p-10 text-center text-sm text-slate-500">Loading results…</div>
              ) : !data?.attempts.length ? (
                <div className="p-10 text-center text-sm text-slate-500">No attempts match these filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead><tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Duration</th></tr></thead>
                    <tbody className="divide-y">
                      {data.attempts.map((attempt) => (
                        <tr key={attempt.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3"><p className="font-medium text-slate-900">{attempt.name || attempt.email || "Anonymous candidate"}</p>{attempt.name && <p className="text-xs text-slate-500">{attempt.email}</p>}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{attempt.status.replace(/_/g, " ")}</Badge></td>
                          <td className="px-4 py-3 font-medium text-slate-900">{attempt.submitted_at ? `${Number(attempt.score_pct).toFixed(1)}% (${attempt.score}/${attempt.total_points} points)` : "—"}</td>
                          <td className="px-4 py-3">{!attempt.submitted_at ? <span className="text-slate-500">Pending</span> : attempt.passed ? <Badge className="bg-slate-100 text-slate-800">Pass</Badge> : <Badge variant="secondary">Did not pass</Badge>}</td>
                          <td className="px-4 py-3 text-slate-600">{new Date(attempt.started_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDuration(attempt.duration_sec)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data && data.pagination.pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm"><span className="text-slate-500">{data.pagination.total} matching attempts</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span>{page} / {data.pagination.pages}</span><Button size="sm" variant="outline" disabled={page >= data.pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>
              )}
            </CardContent>
          </Card>
        </>
      )) : (
        <EvidenceReview
          data={evidenceQuery.data}
          loading={evidenceQuery.isLoading}
          error={evidenceQuery.error as Error | null}
          selectedAttemptId={selectedAttemptId}
          onSelect={setSelectedAttemptId}
          detail={detailQuery.data}
          detailLoading={detailQuery.isLoading}
          onClose={() => setSelectedAttemptId(null)}
        />
      )}
    </DashboardLayout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle><div className="text-slate-400">{icon}</div></CardHeader><CardContent><div className="text-2xl font-semibold text-slate-900">{value}</div></CardContent></Card>;
}

const evidenceEventLabels: Record<string, string> = {
  session_started: "Exam session started",
  session_resumed: "Session restored after refresh",
  network_offline: "Connection lost",
  network_online: "Connection restored",
  visibility_hidden: "Exam tab hidden",
  visibility_visible: "Exam tab visible",
  window_blur: "Browser window lost focus",
  window_focus: "Browser window regained focus",
  fullscreen_enter: "Fullscreen entered",
  fullscreen_exit: "Fullscreen exited",
  fullscreen_unavailable: "Fullscreen unavailable",
  paste: "Paste action detected (content not collected)",
};

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function timestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}

function EvidenceReview({
  data,
  loading,
  error,
  selectedAttemptId,
  onSelect,
  detail,
  detailLoading,
  onClose,
}: {
  data?: EvidencePayload;
  loading: boolean;
  error: Error | null;
  selectedAttemptId: number | null;
  onSelect: (id: number) => void;
  detail?: EvidenceDetailPayload;
  detailLoading: boolean;
  onClose: () => void;
}) {
  if (error) return <Card className="border-slate-200 bg-slate-50"><CardContent className="p-4 text-sm text-slate-950">{error.message}</CardContent></Card>;
  if (loading) return <Card><CardContent className="p-10 text-center text-sm text-slate-500">Loading evidence summaries…</CardContent></Card>;

  const attempts = data?.attempts ?? [];
  const networkEvents = attempts.reduce((sum, attempt) => sum + numeric(attempt.network_interruption_count), 0);
  const browserEvents = attempts.reduce((sum, attempt) => sum
    + numeric(attempt.visibility_hidden_count)
    + numeric(attempt.fullscreen_exit_count)
    + numeric(attempt.paste_count), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Activity className="h-5 w-5" />} label="Evidence records" value={attempts.length} />
        <Stat icon={<MonitorUp className="h-5 w-5" />} label="Browser signals" value={browserEvents} />
        <Stat icon={<WifiOff className="h-5 w-5" />} label="Connection events" value={networkEvents} />
      </div>

      <Card className="border-slate-200 bg-slate-50/60">
        <CardContent className="flex gap-3 p-4 text-sm text-slate-950">
          <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Context for human review — not an AI verdict</p>
            <p className="mt-1 text-slate-800">{data?.evidenceBoundary || "Browser signals do not alter assessment scoring."}</p>
            <p className="mt-1 text-slate-800">Camera, microphone, screen contents, clipboard contents and keystrokes are not collected.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Candidate evidence summaries</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!attempts.length ? (
            <div className="p-10 text-center text-sm text-slate-500">No attempts yet. Evidence appears after a candidate starts this exam.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead><tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Browser signals</th><th className="px-4 py-3">Connection</th><th className="px-4 py-3">Last autosave</th><th className="px-4 py-3">Consent</th><th className="px-4 py-3"></th></tr></thead>
                <tbody className="divide-y">
                  {attempts.map((attempt) => {
                    const browserSignals = numeric(attempt.visibility_hidden_count) + numeric(attempt.fullscreen_exit_count) + numeric(attempt.paste_count);
                    const disconnected = numeric(attempt.disconnected_seconds);
                    return (
                      <tr key={attempt.id} className={selectedAttemptId === attempt.id ? "bg-slate-50/60" : "hover:bg-slate-50"}>
                        <td className="px-4 py-3"><p className="font-medium text-slate-900">{attempt.email || "Anonymous candidate"}</p><p className="text-xs text-slate-500">Attempt #{attempt.id}</p></td>
                        <td className="px-4 py-3"><Badge variant="outline">{attempt.proctor_mode === "browser_evidence" ? "Browser evidence" : "Standard"}</Badge></td>
                        <td className="px-4 py-3">{attempt.proctor_mode === "browser_evidence" ? `${browserSignals} event${browserSignals === 1 ? "" : "s"}` : <span className="text-slate-500">Not collected</span>}</td>
                        <td className="px-4 py-3"><span>{numeric(attempt.network_interruption_count)} interruption{numeric(attempt.network_interruption_count) === 1 ? "" : "s"}</span>{disconnected > 0 && <p className="text-xs text-slate-500">{formatDuration(disconnected)} recorded</p>}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{timestamp(attempt.last_autosave_at)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{timestamp(attempt.evidence_consent_at)}</td>
                        <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => onSelect(attempt.id)}><Eye className="mr-1 h-3.5 w-3.5" /> Review</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAttemptId && (
        <EvidenceTimeline data={detail} loading={detailLoading} onClose={onClose} />
      )}
    </div>
  );
}

function EvidenceTimeline({ data, loading, onClose }: { data?: EvidenceDetailPayload; loading: boolean; onClose: () => void }) {
  return (
    <Card className="border-slate-300 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div><CardTitle className="text-base">Evidence timeline</CardTitle><p className="mt-1 text-xs text-slate-500">{data?.attempt.email || "Candidate attempt"}</p></div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading evidence…</div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <EvidenceFact icon={<ShieldCheck className="h-4 w-4" />} label="Consent" value={data.attempt.evidenceConsentAt ? `Recorded ${timestamp(data.attempt.evidenceConsentAt)}` : "Not recorded"} />
              <EvidenceFact icon={<Network className="h-4 w-4" />} label="Last heartbeat" value={timestamp(data.attempt.lastHeartbeatAt)} />
              <EvidenceFact icon={<MonitorUp className="h-4 w-4" />} label="Mode" value={data.attempt.proctorMode === "browser_evidence" ? "Browser evidence" : "Standard"} />
            </div>
            {!data.events.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">No evidence events were received for this attempt.</div>
            ) : (
              <ol className="relative ml-2 space-y-4 border-l border-slate-200">
                {data.events.map((event) => (
                  <li key={event.id} className="ml-5">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                    <p className="text-sm font-medium text-slate-900">{evidenceEventLabels[event.eventType] || event.eventType.replace(/_/g, " ")}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{timestamp(event.clientAt || event.occurredAt)}{event.metadata?.durationMs ? ` · ${formatDuration(Math.round(event.metadata.durationMs / 1000))}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
            <p className="border-t pt-4 text-xs leading-5 text-slate-500">A tab switch, focus change, paste event, fullscreen exit or connection interruption can be legitimate. Review context and the published exam policy before taking action.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-500">{icon}{label}</div><p className="mt-2 text-sm text-slate-900">{value}</p></div>;
}
