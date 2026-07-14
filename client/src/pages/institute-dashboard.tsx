import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import {
  Users,
  Layers,
  ClipboardList,
  FileQuestion,
  BarChart3,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
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

export default function InstituteDashboard() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && (!user || !token)) {
      setLocation('/institute/login');
    }
  }, [authLoading, user, token, setLocation]);

  const { data: institute, error, isLoading, refetch } = useQuery<Institute>({
    queryKey: ['/api/me/institute'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/me/institute');
      return res.json();
    },
  });

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery<{ students: number; cohorts: number; activeExams: number }>({
    queryKey: ['/api/institute/stats'],
    enabled: !!user && !!token && !!institute?.id,
    queryFn: async () => (await apiRequest('GET', '/api/institute/stats')).json(),
  });

  if (!user) return null;

  const isStaff = institute?.memberRole === 'staff';
  const canManageIdentity = institute?.memberRole === 'owner' || institute?.memberRole === 'admin';

  const headerSubtitle = isLoading
    ? 'Loading your institute workspace…'
    : institute?.status === 'pending'
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
      actions={institute && !isStaff ? (
        <Button onClick={() => setLocation('/institute/exams/new')} className="w-full bg-slate-900 text-white sm:w-auto" disabled={!!error}>
          <Plus className="w-4 h-4 mr-2" /> Create exam
        </Button>
      ) : undefined}
    >
      <SEO title="Institute dashboard" description="Skill-verify your students at scale." path="/institute/dashboard" />

      {error ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-slate-900">We couldn't open this institute workspace</h2>
                <p className="mt-1 text-sm text-slate-600">Check your connection and try again. No workspace data has been changed.</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {institute?.status === 'pending' ? (
            <Card className="mb-6 border-amber-200 bg-amber-50/70">
              <CardContent className="flex gap-3 p-4 sm:p-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-slate-900">Institute verification is in progress</h2>
                  <p className="mt-1 text-sm text-slate-700">{isStaff ? 'You can review this operational overview while workspace verification is in progress.' : 'You can prepare students, question banks, and exams now. Restricted publishing features unlock after approval.'}</p>
                </div>
              </CardContent>
            </Card>
          ) : institute?.status === 'rejected' ? (
            <Card className="mb-6 border-rose-200 bg-rose-50/70">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-slate-900">Your institute details need attention</h2>
                    <p className="mt-1 text-sm text-slate-700">{canManageIdentity ? 'Review the workspace identity and submit corrected details before publishing.' : 'Ask an institute owner or admin to review the workspace identity and submit corrected details.'}</p>
                  </div>
                </div>
                {canManageIdentity && <Button variant="outline" className="w-full sm:w-auto" onClick={() => setLocation('/institute/settings')}>Review details</Button>}
              </CardContent>
            </Card>
          ) : null}

          <section aria-labelledby="workspace-overview-heading">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="workspace-overview-heading" className="text-lg font-semibold text-slate-900">Workspace overview</h2>
                <p className="text-sm text-slate-600">Capacity and live assessment activity at a glance.</p>
              </div>
              {statsError ? (
                <Button variant="ghost" className="w-full justify-start text-slate-700 sm:w-auto" onClick={() => void refetchStats()}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Reload metrics
                </Button>
              ) : null}
            </div>
            <div className="mb-8 grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Students"
                value={`${stats?.students ?? 0} / ${institute?.studentSeatLimit ?? 500}`}
                icon={<Users className="h-5 w-5" />}
                loading={isLoading || statsLoading}
                current={stats?.students}
                limit={institute?.studentSeatLimit}
              />
              <StatCard
                label="Cohorts"
                value={`${stats?.cohorts ?? 0} / ${institute?.cohortLimit ?? 5}`}
                icon={<Layers className="h-5 w-5" />}
                loading={isLoading || statsLoading}
                current={stats?.cohorts}
                limit={institute?.cohortLimit}
              />
              <StatCard label="Active exams" value={String(stats?.activeExams ?? 0)} icon={<ClipboardList className="h-5 w-5" />} loading={isLoading || statsLoading} />
            </div>
          </section>

          {isStaff ? (
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex gap-3 p-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-slate-900">Operational overview access</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">You can view this institute overview. Course, assessment, roster, reporting, billing, and team-management actions require a teacher, admin, or owner role.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
          <section aria-labelledby="assessment-workflow-heading">
            <Card>
              <CardHeader className="border-b border-slate-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 id="assessment-workflow-heading" className="text-lg font-semibold text-slate-900">Assessment workflow</h2>
                    <p className="mt-1 text-sm text-slate-600">Move from roster to verified results in four clear steps.</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-900">{institute?.plan ? institute.plan.charAt(0).toUpperCase() + institute.plan.slice(1) : 'Starter'}</span>
                    <span aria-hidden="true">plan</span>
                    <Button variant="ghost" className="h-11 px-2 text-sm" onClick={() => setLocation('/pricing')}>Upgrade</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <WorkflowStep
                    number="01"
                    title="Add students"
                    description="Build the learner roster and organize cohorts."
                    icon={<Users className="h-5 w-5" />}
                    onClick={() => setLocation('/institute/students')}
                  />
                  <WorkflowStep
                    number="02"
                    title="Build a question bank"
                    description="Create reusable, governed assessment content."
                    icon={<FileQuestion className="h-5 w-5" />}
                    onClick={() => setLocation('/institute/question-banks')}
                  />
                  <WorkflowStep
                    number="03"
                    title="Publish an exam"
                    description="Set controls, proctoring, and a secure share link."
                    icon={<ClipboardList className="h-5 w-5" />}
                    onClick={() => setLocation('/institute/exams/new')}
                  />
                  <WorkflowStep
                    number="04"
                    title="Review outcomes"
                    description="Analyze submissions, evidence, and pass rates."
                    icon={<BarChart3 className="h-5 w-5" />}
                    onClick={() => setLocation('/institute/reports')}
                  />
                </div>
              </CardContent>
            </Card>
          </section>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
  current,
  limit,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  loading: boolean;
  current?: number;
  limit?: number;
}) {
  const usage = current !== undefined && limit ? Math.min(100, Math.round((current / limit) * 100)) : null;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
        <div className="text-slate-400">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3" aria-label={`Loading ${label}`}>
            <Skeleton className="h-9 w-28" />
            {limit ? <Skeleton className="h-1.5 w-full" /> : null}
          </div>
        ) : (
          <>
            <div className="text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">{value}</div>
            {usage !== null ? (
              <div className="mt-3" aria-label={`${label} capacity ${usage}% used`}>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-700" style={{ width: `${usage}%` }} />
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WorkflowStep({
  number,
  title,
  description,
  icon,
  onClick,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-36 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      aria-label={`${number}. ${title}: ${description}`}
    >
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-700 shadow-sm" aria-hidden="true">{icon}</span>
        <span className="text-xs font-semibold tracking-wider text-slate-400">{number}</span>
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
      <span className="mt-3 inline-flex items-center text-sm font-medium text-slate-800">
        Open <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </button>
  );
}
