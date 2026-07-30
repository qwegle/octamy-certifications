import { useEffect } from "react";
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { Users, ClipboardList, CheckCircle2, Percent, Download, Eye, AlertCircle, RefreshCw, BarChart3 } from "lucide-react";

type Report = {
  cohorts: number;
  students: number;
  attempts: number;
  passed: number;
  submitted: number;
  passRate: number;
  recent: { id: number; instance_id: number; email: string | null; name: string | null; score: number | null; total_questions: number | null; score_pct: number; passed: boolean | null; status: string; proctor_mode: string; started_at: string; submitted_at: string | null; exam_title: string }[];
};

export default function InstituteReports() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data, isLoading, error, refetch } = useQuery<Report>({
    queryKey: ["/api/institute/reports"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/institute/reports")).json(),
  });

  const exportCsv = () => {
    if (!data) return;
    const header = ["id", "exam", "name", "email", "score", "total_questions", "score_percent", "passed", "status", "evidence_mode", "submitted_at"];
    const rows = data.recent.map((r) =>
      [r.id, r.exam_title, r.name ?? "", r.email ?? "", r.score ?? "", r.total_questions ?? "", r.submitted_at ? r.score_pct : "", r.submitted_at ? (r.passed ? "yes" : "no") : "", r.status, r.proctor_mode, r.submitted_at ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `institute-attempts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!user) return null;

  return (
    <DashboardLayout
      role="institute"
      title="Reports"
      description="Monitor assessment outcomes, candidate activity, and proctoring evidence."
      breadcrumbs={[{ label: 'Institute', href: '/institute/dashboard' }, { label: 'Reports' }]}
      actions={
        <Button className="w-full sm:w-auto" variant="outline" onClick={exportCsv} disabled={!data?.recent?.length}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export recent CSV
        </Button>
      }
    >
      <SEO title="Reports · Institute" description="Attempts, pass rates, and student activity." path="/institute/reports" />

      {error ? (
        <Card className="border-slate-200 bg-slate-50/60">
          <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-slate-900">Reports are temporarily unavailable</h2>
                <p className="mt-1 text-sm text-slate-600">We couldn't retrieve the latest assessment data. Try again in a moment.</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-labelledby="report-overview-title">
            <h2 id="report-overview-title" className="sr-only">Assessment overview</h2>
            <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat icon={<Users className="h-5 w-5" />} label="Students" value={data?.students ?? 0} loading={isLoading} />
              <Stat icon={<ClipboardList className="h-5 w-5" />} label="Attempts" value={data?.attempts ?? 0} loading={isLoading} />
              <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Passed" value={data?.passed ?? 0} loading={isLoading} />
              <Stat icon={<Percent className="h-5 w-5" />} label="Pass rate" value={`${data?.passRate ?? 0}%`} loading={isLoading} />
            </div>
          </section>

          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-base">Recent attempts</CardTitle>
              <p className="text-sm text-slate-500">The latest candidate submissions across all institute exams.</p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-4 p-5" aria-busy="true" aria-label="Loading recent attempts">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
                      <Skeleton className="h-5 w-48 max-w-[70%]" />
                      <Skeleton className="h-4 w-full max-w-lg" />
                    </div>
                  ))}
                </div>
              ) : !data?.recent?.length ? (
                <div className="px-5 py-12 text-center">
                  <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <BarChart3 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="font-semibold text-slate-900">No attempts to report yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                    Results will appear automatically after a candidate starts or submits one of your exams.
                  </p>
                  <Button className="mt-5 w-full sm:w-auto" variant="outline" onClick={() => setLocation('/institute/exams')}>
                    View exams
                  </Button>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 md:hidden">
                    {data.recent.map((attempt) => (
                      <AttemptCard key={attempt.id} attempt={attempt} onReview={() => setLocation(`/institute/exams/${attempt.instance_id}/results`)} />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block" tabIndex={0} aria-label="Scrollable recent attempts table">
                    <table className="w-full min-w-[940px] text-sm">
                      <caption className="sr-only">Recent assessment attempts and results</caption>
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                          <th scope="col" className="px-5 py-3 text-left font-medium">Exam</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Candidate</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Score</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Result</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Submitted</th>
                          <th scope="col" className="px-4 py-3 text-left font-medium">Proctoring</th>
                          <th scope="col" className="px-5 py-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent.map((attempt) => (
                          <tr key={attempt.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                            <td className="max-w-[220px] px-5 py-4 font-medium text-slate-900"><span className="block truncate">{attempt.exam_title}</span></td>
                            <td className="px-4 py-4 text-slate-700">
                              <span className="block font-medium">{attempt.name || attempt.email || "Anonymous candidate"}</span>
                              {attempt.name && attempt.email ? <span className="block text-xs text-slate-500">{attempt.email}</span> : null}
                            </td>
                            <td className="px-4 py-4 text-slate-700">{formatScore(attempt)}</td>
                            <td className="px-4 py-4"><ResultBadge attempt={attempt} /></td>
                            <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatSubmitted(attempt)}</td>
                            <td className="px-4 py-4 text-slate-600">{formatProctorMode(attempt.proctor_mode)}</td>
                            <td className="px-5 py-4 text-right">
                              <Button variant="ghost" onClick={() => setLocation(`/institute/exams/${attempt.instance_id}/results`)} aria-label={`Review ${attempt.name || attempt.email || 'candidate'} attempt`}>
                                <Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Review
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}

function Stat({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
        <div className="text-slate-400">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-9 w-20" /> : <div className="text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">{value}</div>}
      </CardContent>
    </Card>
  );
}

function AttemptCard({ attempt, onReview }: { attempt: Report["recent"][number]; onReview: () => void }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{attempt.exam_title}</h3>
          <p className="mt-1 truncate text-sm text-slate-600">{attempt.name || attempt.email || "Anonymous candidate"}</p>
          {attempt.name && attempt.email ? <p className="truncate text-xs text-slate-500">{attempt.email}</p> : null}
        </div>
        <ResultBadge attempt={attempt} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Score</dt>
          <dd className="mt-1 font-medium text-slate-800">{formatScore(attempt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Proctoring</dt>
          <dd className="mt-1 text-slate-700">{formatProctorMode(attempt.proctor_mode)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted</dt>
          <dd className="mt-1 text-slate-700">{formatSubmitted(attempt)}</dd>
        </div>
      </dl>
      <Button variant="outline" className="mt-4 w-full" onClick={onReview} aria-label={`Review ${attempt.name || attempt.email || 'candidate'} attempt`}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" /> Review attempt
      </Button>
    </article>
  );
}

function ResultBadge({ attempt }: { attempt: Report["recent"][number] }) {
  if (!attempt.submitted_at) {
    return <Badge variant="outline" className="shrink-0 border-slate-300 bg-slate-50 text-slate-800">In progress</Badge>;
  }
  if (attempt.passed) {
    return <Badge className="shrink-0 bg-slate-100 text-slate-800 hover:bg-slate-100">Pass</Badge>;
  }
  return <Badge variant="outline" className="shrink-0 border-slate-300 bg-slate-50 text-slate-700">Not passed</Badge>;
}

function formatScore(attempt: Report["recent"][number]) {
  return attempt.submitted_at && attempt.total_questions
    ? `${Number(attempt.score_pct).toFixed(1)}% (${attempt.score}/${attempt.total_questions})`
    : "—";
}

function formatSubmitted(attempt: Report["recent"][number]) {
  return attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "Not submitted";
}

function formatProctorMode(mode: string) {
  return mode === "browser_evidence" ? "Browser evidence" : "Standard";
}
