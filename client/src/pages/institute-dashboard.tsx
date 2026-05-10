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
  BarChart3,
  Plus,
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
  { key: 'students', label: 'Students', icon: Users, href: '/institute/students' },
  { key: 'cohorts', label: 'Cohorts', icon: Layers, href: '/institute/students' },
  { key: 'banks', label: 'Question Banks', icon: FileQuestion, href: '/question-banks' },
  { key: 'exams', label: 'Exams', icon: ClipboardList, href: '/institute/exams' },
  { key: 'reports', label: 'Reports', icon: BarChart3, href: '/institute/reports' },
  { key: 'team', label: 'Team', icon: GraduationCap, href: '/institute/team' },
  { key: 'certificates', label: 'Certificates', icon: Award, href: '/business-certificates' },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, href: '/profile-edit' },
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

  const { data: stats } = useQuery<{ students: number; cohorts: number; activeExams: number }>({
    queryKey: ['/api/institute/stats'],
    enabled: !!user && !!token && institute?.status === 'verified',
    queryFn: async () => (await apiRequest('GET', '/api/institute/stats')).json(),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
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
            <Button onClick={() => setLocation('/institute/exams/new')} className="bg-slate-900 hover:bg-black text-white">
              <Plus className="w-4 h-4 mr-2" /> Create exam
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
            <StatCard label="Students" value={`${stats?.students ?? 0} / ${institute?.studentSeatLimit ?? 500}`} icon={<Users className="w-5 h-5" />} />
            <StatCard label="Cohorts" value={`${stats?.cohorts ?? 0} / ${institute?.cohortLimit ?? 5}`} icon={<Layers className="w-5 h-5" />} />
            <StatCard label="Active exams" value={String(stats?.activeExams ?? 0)} icon={<ClipboardList className="w-5 h-5" />} />
          </div>

          <div className="grid lg:grid-cols-[220px_1fr] gap-6">
            <aside className="space-y-1">
              {SIDEBAR.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => setLocation(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100 text-left"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </aside>
            <Card className="border-cream-deep">
              <CardHeader>
                <CardTitle className="text-base font-medium text-slate-900">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">
                  Add students, build question banks, and ship exams with share links. Reports show pass rates and recent attempts.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setLocation('/institute/exams/new')} className="bg-slate-900 text-white">
                    <Plus className="w-4 h-4 mr-1" /> Create exam
                  </Button>
                  <Button onClick={() => setLocation('/institute/students')} variant="outline">Manage students</Button>
                  <Button onClick={() => setLocation('/question-banks')} variant="outline">Question banks</Button>
                  <Button onClick={() => setLocation('/institute/reports')} variant="outline">View reports</Button>
                  <Button onClick={() => setLocation('/pricing')} variant="outline">Upgrade plan</Button>
                </div>
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
