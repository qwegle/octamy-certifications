import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import Footer from "@/components/footer";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { Wallet, ClipboardList, Award, Download } from "lucide-react";

type Earnings = {
  totals: { revenueINR: number; attempts: number; certificates: number };
  payments: { id: number; amount: string; status: string; created_at: string; course_title: string }[];
  attempts: { id: number; score: number; passed: boolean; created_at: string; course_title: string }[];
};

export default function CreatorEarnings() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/creator/login");
  }, [authLoading, user, token, setLocation]);

  const { data, isLoading } = useQuery<Earnings>({
    queryKey: ["/api/creator/earnings"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/creator/earnings")).json(),
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["type", "id", "course", "amount_or_score", "status_or_passed", "date"].join(","),
      ...data.payments.map((p) => ["payment", p.id, `"${p.course_title}"`, p.amount, p.status, p.created_at].join(",")),
      ...data.attempts.map((a) => ["attempt", a.id, `"${a.course_title}"`, a.score, a.passed ? "pass" : "fail", a.created_at].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `creator-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Earnings · Creator" description="Track your course revenue, attempts and certificates." path="/creator/earnings" />
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Creator", href: "/creator/dashboard" }, { label: "Earnings" }]} />
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Earnings</h1>
            <p className="text-sm text-slate-600 mt-1">Live revenue, attempts and certificate sales across your courses.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!data}>
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => setLocation("/creator/payouts")} className="bg-slate-900 text-white">Payouts</Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Stat icon={<Wallet className="w-5 h-5" />} label="Lifetime revenue" value={`₹${(data?.totals.revenueINR ?? 0).toLocaleString("en-IN")}`} />
          <Stat icon={<ClipboardList className="w-5 h-5" />} label="Attempts" value={data?.totals.attempts ?? 0} />
          <Stat icon={<Award className="w-5 h-5" />} label="Certificates sold" value={data?.totals.certificates ?? 0} />
        </div>

        <Card className="border-slate-200 mb-6">
          <CardHeader><CardTitle className="text-base">Recent payments</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <div className="text-sm text-slate-500 py-6 text-center">Loading…</div>
              : !data?.payments.length ? <div className="text-sm text-slate-500 py-6 text-center">No payments yet.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-slate-500">
                      <th className="text-left font-medium py-2">Course</th>
                      <th className="text-left font-medium py-2">Amount</th>
                      <th className="text-left font-medium py-2">Status</th>
                      <th className="text-left font-medium py-2">When</th>
                    </tr></thead>
                    <tbody>
                      {data.payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-2 text-slate-900">{p.course_title || "—"}</td>
                          <td className="py-2">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                          <td className="py-2"><Badge variant="outline" className="capitalize">{p.status}</Badge></td>
                          <td className="py-2 text-slate-600">{new Date(p.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base">Recent attempts</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <div className="text-sm text-slate-500 py-6 text-center">Loading…</div>
              : !data?.attempts.length ? <div className="text-sm text-slate-500 py-6 text-center">No attempts yet.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-slate-500">
                      <th className="text-left font-medium py-2">Course</th>
                      <th className="text-left font-medium py-2">Score</th>
                      <th className="text-left font-medium py-2">Result</th>
                      <th className="text-left font-medium py-2">When</th>
                    </tr></thead>
                    <tbody>
                      {data.attempts.map((a) => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2 text-slate-900">{a.course_title || "—"}</td>
                          <td className="py-2">{a.score}</td>
                          <td className="py-2">
                            {a.passed ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Pass</Badge> : <Badge variant="outline">Fail</Badge>}
                          </td>
                          <td className="py-2 text-slate-600">{new Date(a.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="border-slate-200">
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
