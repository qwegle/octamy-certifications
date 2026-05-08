import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import {
  Users,
  Layers,
  ClipboardList,
  GraduationCap,
  Award,
  Settings as SettingsIcon,
  FileQuestion,
} from 'lucide-react';

type Institute = {
  id: number;
  name: string;
  slug: string;
  status: 'pending' | 'verified' | 'rejected';
  plan: 'starter' | 'growth' | 'enterprise';
  studentSeatLimit: number;
  cohortLimit: number;
  memberRole: 'owner' | 'admin' | 'teacher' | 'staff';
};

const SIDEBAR = [
  { key: 'students', label: 'Students', icon: Users },
  { key: 'cohorts', label: 'Cohorts', icon: Layers },
  { key: 'banks', label: 'Question Banks', icon: FileQuestion },
  { key: 'exams', label: 'Exams', icon: ClipboardList },
  { key: 'certificates', label: 'Certificates', icon: Award },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
] as const;

export default function InstituteDashboard() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && (!user || !token)) {
      setLocation('/institute/login');
    }
  }, [authLoading, user, token, setLocation]);

  const { data: institute, error } = useQuery<Institute>({
    queryKey: ['/api/me/institute'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/me/institute');
      return res.json();
    },
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Institute dashboard" description="Skill-verify your students at scale." path="/institute/dashboard" />
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Institute</p>
              <h1 className="text-3xl font-semibold text-slate-900">
                {institute?.name || 'Your institute'}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {institute?.status === 'pending' && "Verification in progress — we'll email you when complete."}
                {institute?.status === 'verified' && `Plan: ${institute.plan.toUpperCase()} · Role: ${institute.memberRole}`}
                {!institute && 'Finish setting up your institute profile.'}
              </p>
            </div>
            <Button className="bg-slate-900 hover:bg-black text-white">
              <GraduationCap className="w-4 h-4 mr-2" /> Invite teacher
            </Button>
          </div>

          {error ? (
            <Card className="border-amber-200 bg-amber-50 mb-6">
              <CardContent className="pt-6 text-sm text-amber-900">
                We couldn't load your institute profile. Try refreshing the page.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="Students" value={`0 / ${institute?.studentSeatLimit ?? 500}`} icon={<Users className="w-5 h-5" />} />
            <StatCard label="Cohorts" value={`0 / ${institute?.cohortLimit ?? 5}`} icon={<Layers className="w-5 h-5" />} />
            <StatCard label="Active exams" value="0" icon={<ClipboardList className="w-5 h-5" />} />
          </div>

          <div className="grid lg:grid-cols-[220px_1fr] gap-6">
            <aside className="space-y-1">
              {SIDEBAR.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100 text-left"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </aside>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-medium text-slate-900">Coming soon — P3</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  The full institute toolkit — students, cohorts, question banks, exams, and certificate
                  issuance — ships in P3. We've already provisioned your workspace, so your historical
                  data will be ready when this lights up.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
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
