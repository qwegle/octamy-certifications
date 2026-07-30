import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { BookOpen, Wallet, Sparkles, Plus } from 'lucide-react';

type Creator = {
  id: number;
  displayName: string;
  slug: string;
  status: 'pending' | 'approved' | 'rejected';
  plan: 'free' | 'pro' | 'premium';
};

export default function CreatorDashboard() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && (!user || !token)) {
      setLocation('/creator/login');
    }
  }, [authLoading, user, token, setLocation]);

  const { data: creator, isLoading, error } = useQuery<Creator>({
    queryKey: ['/api/me/creator'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/me/creator');
      return res.json();
    },
  });

  const { data: stats } = useQuery<{ coursesCount: number; attempts: number; certificates: number; revenueINR: number; plan: string; status: string }>({
    queryKey: ['/api/creator/stats'],
    enabled: !!user && !!token && creator?.status === 'approved',
    queryFn: async () => (await apiRequest('GET', '/api/creator/stats')).json(),
  });

  if (!user) return null;

  return (
    <DashboardLayout role="creator" title="Dashboard" breadcrumbs={[{ label: 'Creator' }, { label: 'Dashboard' }]}>
      <SEO title="Creator dashboard" description="Manage your courses and earnings on Octamy." path="/creator/dashboard" />
              <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Creator</p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Welcome, {creator?.displayName || user.name}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {creator?.status === 'pending' && 'Your creator profile is under review.'}
                {creator?.status === 'approved' && `Plan: ${creator.plan.toUpperCase()}.`}
                {!creator && !isLoading && 'Finish setting up your creator profile.'}
              </p>
            </div>
            <Button
              onClick={() => setLocation('/creator/courses/new')}
              className="bg-slate-900 hover:bg-black text-white"
            >
              <Plus className="w-4 h-4 mr-2" /> New course
            </Button>
          </div>

          {error ? (
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="pt-6 text-sm text-slate-900">
                We couldn't load your creator profile. Try refreshing the page.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard icon={<BookOpen className="w-5 h-5" />} label="My courses" value={String(stats?.coursesCount ?? 0)} cta="Manage courses →" onClick={() => setLocation('/creator/courses')} />
            <StatCard icon={<Wallet className="w-5 h-5" />} label="Gross course sales" value={`₹${(stats?.revenueINR ?? 0).toLocaleString('en-IN')}`} sub={`${stats?.attempts ?? 0} attempts · ${stats?.certificates ?? 0} certificates`} cta="View sales →" onClick={() => setLocation('/creator/earnings')} />
            <StatCard icon={<Sparkles className="w-5 h-5" />} label="Plan" value={(creator?.plan || 'free').toUpperCase()} cta="Upgrade plan →" onClick={() => setLocation('/pricing')} />
          </div>

          <Tabs defaultValue="courses" className="w-full">
            <TabsList>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="courses">
              <Card className="border-cream-deep mt-4">
                <CardContent className="py-10 text-center">
                  <h3 className="text-lg font-medium text-slate-900">Build, list, and track your courses</h3>
                  <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">Submit a course for review. Once approved, learners can enroll, take the assessment, and optionally activate a status-aware credential after passing.</p>
                  <div className="flex items-center justify-center gap-2 mt-5">
                    <Button onClick={() => setLocation('/creator/courses')} variant="outline">View all</Button>
                    <Button onClick={() => setLocation('/creator/courses/new')} className="bg-slate-900 text-white">Create new</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="earnings">
              <Card className="border-cream-deep mt-4">
                <CardContent className="py-10 text-center">
                  <h3 className="text-lg font-medium text-slate-900">Gross course sales: ₹{(stats?.revenueINR ?? 0).toLocaleString('en-IN')}</h3>
                  <p className="text-sm text-slate-600 mt-2">This is gross customer revenue, not your withdrawable balance. See payment-by-payment details and payout entries.</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button onClick={() => setLocation('/creator/earnings')} className="bg-slate-900 text-white">View full report</Button>
                    <Button onClick={() => setLocation('/creator/payouts')} variant="outline">Payouts</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="settings">
              <Card className="border-cream-deep mt-4">
                <CardContent className="py-10 text-center">
                  <h3 className="text-lg font-medium text-slate-900">Profile settings</h3>
                  <p className="text-sm text-slate-600 mt-2">Edit your public creator page from your profile.</p>
                  <Button onClick={() => setLocation('/profile-edit')} variant="outline" className="mt-4">Edit profile</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
  );
}

function StatCard({
  icon, label, value, sub, cta, onClick,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; cta?: string; onClick?: () => void;
}) {
  return (
    <Card className="border-cream-deep">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-slate-600">{label}</CardTitle>
        <div className="text-slate-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-slate-900">{value}</div>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        {cta && (
          <button onClick={onClick} className="text-sm text-slate-900 hover:underline mt-2">
            {cta}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
