import { useEffect } from "react";
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { Users, ClipboardList, CheckCircle2, Percent, Download } from "lucide-react";

type Report = {
  cohorts: number;
  students: number;
  attempts: number;
  passed: number;
  submitted: number;
  passRate: number;
  recent: { id: number; email: string | null; score: number | null; passed: boolean | null; submitted_at: string | null; exam_title: string }[];
};

export default function InstituteReports() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data, isLoading } = useQuery<Report>({
    queryKey: ["/api/institute/reports"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/institute/reports")).json(),
  });

  const exportCsv = () => {
    if (!data) return;
    const header = ["id", "exam", "email", "score", "passed", "submitted_at"];
    const rows = data.recent.map((r) =>
      [r.id, r.exam_title, r.email ?? "", r.score ?? "", r.passed ? "yes" : "no", r.submitted_at ?? ""]
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
    <DashboardLayout role="institute" title="Reports" breadcrumbs={[{ label: 'Institute', href: '/institute/dashboard' }, { label: 'Reports' }]}>
      <SEO title="Reports · Institute" description="Attempts, pass rates, and student activity." path="/institute/reports" />
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-600 mt-1">Live attempts and pass rates across your exams.</p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!data?.recent?.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 mb-6">
          <Stat icon={<Users className="w-5 h-5" />} label="Students" value={data?.students ?? 0} />
          <Stat icon={<ClipboardList className="w-5 h-5" />} label="Attempts" value={data?.attempts ?? 0} />
          <Stat icon={<CheckCircle2 className="w-5 h-5" />} label="Passed" value={data?.passed ?? 0} />
          <Stat icon={<Percent className="w-5 h-5" />} label="Pass rate" value={`${data?.passRate ?? 0}%`} />
        </div>

        <Card className="border-cream-deep">
          <CardHeader><CardTitle className="text-base">Recent attempts</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>
            ) : !data?.recent?.length ? (
              <div className="text-sm text-slate-500 py-8 text-center">
                No attempts yet. Once students take your exams, results show up here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left font-medium py-2">Exam</th>
                      <th className="text-left font-medium py-2">Email</th>
                      <th className="text-left font-medium py-2">Score</th>
                      <th className="text-left font-medium py-2">Result</th>
                      <th className="text-left font-medium py-2">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 text-slate-900">{r.exam_title}</td>
                        <td className="py-2 text-slate-700">{r.email || "—"}</td>
                        <td className="py-2">{r.score ?? "—"}</td>
                        <td className="py-2">
                          {r.passed ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Pass</Badge>
                          ) : r.submitted_at ? (
                            <Badge variant="outline">Fail</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">In progress</Badge>
                          )}
                        </td>
                        <td className="py-2 text-slate-600">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="border-cream-deep">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
        <div className="text-slate-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}
