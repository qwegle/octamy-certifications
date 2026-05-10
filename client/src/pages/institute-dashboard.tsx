import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
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
    enabled: !!user && !!token && !!institute?.id,
    queryFn: async () => (await apiRequest('GET', '/api/institute/stats')).json(),
  });

  if (!user) return null;

  const headerSubtitle = institute?.status === 'pending'
    ? "Verification in progress — we'll email you when complete."
    : institute?.status === 'verified'
    ? `Plan: ${institute.plan.toUpperCase()} · Role: ${institute.memberRole}`
    : 'Finish setting up your institute profile.';

  return (
    <DashboardLayout
      role="institute"
      title={institute?.name || 'Your institute'}
      description={headerSubtitle}
      breadcrumbs={[{ label: 'Institute' }, { label: 'Dashboard' }]}
      actions={
        <Button onClick={() => setLocation('/institute/exams/new')} className="bg-slate-900 hover:bg-black text-white">
          <Plus className="w-4 h-4 mr-2" /> Create exam
        </Button>
      }
    >
      <SEO title="Institute dashboard" description="Skill-verify your students at scale." path="/institute/dashboard" />

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
    </DashboardLayout>
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
