import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import RecruiterLayout from '../components/RecruiterLayout';
import InterviewEvidenceNotice from '../components/InterviewEvidenceNotice';
import { Eye, Download, History, CreditCard, BarChart3 } from 'lucide-react';

type Analytics = {
  totals: { profileViews: number; cvDownloads: number; interviewAccess: number; creditsUsed: number };
  daily: { day: string; accesses: number; credits: number }[];
  recentAccess: { id: number; access_type: string; credits_used: string; created_at: string; user_name: string | null }[];
  recentTransactions: { id: number; type: string; amount: string; description: string; balance_after: string; created_at: string }[];
};

export default function RecruiterAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiRequest('GET', '/api/recruiter/analytics');
        if (r.ok) setData(await r.json());
      } catch {
        // soft fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isHistoricalInterviewAccess = (value: string) => value.toLowerCase().includes('interview');

  const formatAccessType = (accessType: string) => isHistoricalInterviewAccess(accessType)
    ? 'Historical interview prototype access'
    : accessType.replace(/_/g, ' ');

  const formatTransactionDescription = (description: string) => isHistoricalInterviewAccess(description)
    ? 'Historical interview prototype access (retired)'
    : description;

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['type', 'id', 'detail', 'value', 'date'].join(','),
      ...data.recentAccess.map((a) => ['access', a.id, formatAccessType(a.access_type), a.user_name || '—', a.created_at].join(',')),
      ...data.recentTransactions.map((t) => ['credit', t.id, formatTransactionDescription(t.description), `${t.amount}`, t.created_at].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recruiter-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <RecruiterLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
              <BarChart3 className="w-6 h-6" /> Analytics
            </h1>
            <p className="text-sm text-gray-600 mt-1">Track your recruitment performance and credit usage.</p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!data}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        <InterviewEvidenceNotice compact />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={<Eye className="w-4 h-4" />} label="Profile views" value={data?.totals.profileViews ?? 0} />
          <Stat icon={<Download className="w-4 h-4" />} label="CV downloads" value={data?.totals.cvDownloads ?? 0} />
          <Stat icon={<History className="w-4 h-4" />} label="Historical interview access" value={data?.totals.interviewAccess ?? 0} hint="Retired prototype" />
          <Stat icon={<CreditCard className="w-4 h-4" />} label="Credits used" value={Number(data?.totals.creditsUsed ?? 0).toFixed(2)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last 30 days access activity</CardTitle>
            <p className="text-xs text-slate-500">Aggregates may include historical prototype activity recorded before Interview Studio was made private.</p>
          </CardHeader>
          <CardContent>
            {loading ? <div className="text-sm text-gray-500 py-6 text-center">Loading…</div>
              : !data?.daily.length ? <div className="text-sm text-gray-500 py-6 text-center">No activity in the last 30 days.</div>
              : (
                <SparkBars data={data.daily.map((d) => ({ label: new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: d.accesses }))} />
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent access</CardTitle></CardHeader>
          <CardContent>
            {!data?.recentAccess.length ? (
              <div className="text-sm text-gray-500 py-6 text-center">No profile access yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-gray-500">
                    <th className="text-left font-medium py-2">Candidate</th>
                    <th className="text-left font-medium py-2">Action</th>
                    <th className="text-left font-medium py-2">Credits</th>
                    <th className="text-left font-medium py-2">When</th>
                  </tr></thead>
                  <tbody>
                    {data.recentAccess.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2">{a.user_name || '—'}</td>
                        <td className="py-2">
                          <Badge variant="outline" className={isHistoricalInterviewAccess(a.access_type) ? 'border-slate-300 bg-slate-50 text-slate-600' : 'capitalize'}>
                            {formatAccessType(a.access_type)}
                          </Badge>
                        </td>
                        <td className="py-2">{a.credits_used}</td>
                        <td className="py-2 text-gray-600">{new Date(a.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Credit transactions</CardTitle></CardHeader>
          <CardContent>
            {!data?.recentTransactions.length ? (
              <div className="text-sm text-gray-500 py-6 text-center">No transactions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-gray-500">
                    <th className="text-left font-medium py-2">Type</th>
                    <th className="text-left font-medium py-2">Amount</th>
                    <th className="text-left font-medium py-2">Balance after</th>
                    <th className="text-left font-medium py-2">Description</th>
                    <th className="text-left font-medium py-2">When</th>
                  </tr></thead>
                  <tbody>
                    {data.recentTransactions.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2"><Badge variant="outline" className="capitalize">{t.type}</Badge></td>
                        <td className={`py-2 ${t.type === 'spend' ? 'text-slate-600' : 'text-slate-700'}`}>{t.type === 'spend' ? '-' : '+'}{t.amount}</td>
                        <td className="py-2">{t.balance_after}</td>
                        <td className="py-2 text-gray-700">
                          <span>{formatTransactionDescription(t.description)}</span>
                          {isHistoricalInterviewAccess(t.description) ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Historical</span> : null}
                        </td>
                        <td className="py-2 text-gray-600">{new Date(t.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RecruiterLayout>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-gray-600">{label}</CardTitle>
        <div className="text-gray-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function SparkBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.label} title={`${d.label}: ${d.value}`} className="flex-1 bg-slate-500/80 hover:bg-slate-500 rounded-t" style={{ height: `${(d.value / max) * 100}%`, minHeight: 2 }} />
      ))}
    </div>
  );
}
