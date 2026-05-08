import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/header';
import Footer from '@/components/footer';
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Creator dashboard" description="Manage your courses and earnings on Octamy." path="/creator/dashboard" />
      <Header />
      <main className="flex-1">
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
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6 text-sm text-amber-900">
                We couldn't load your creator profile. Try refreshing the page.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard icon={<BookOpen className="w-5 h-5" />} label="My courses" value="0" cta="Create your first course →" onClick={() => setLocation('/creator/courses/new')} />
            <StatCard icon={<Wallet className="w-5 h-5" />} label="Earnings" value="₹0" sub="Lifetime gross" />
            <StatCard icon={<Sparkles className="w-5 h-5" />} label="Plan" value={(creator?.plan || 'free').toUpperCase()} sub="Upgrade for more reach" />
          </div>

          <Tabs defaultValue="courses" className="w-full">
            <TabsList>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="courses">
              <PanelComingSoon title="Course builder coming in P4" body="You'll be able to create paid courses, set pricing, and publish to Octamy." />
            </TabsContent>
            <TabsContent value="earnings">
              <PanelComingSoon title="Earnings & payouts — P4" body="Track sales, commissions, and request payouts to UPI or bank." />
            </TabsContent>
            <TabsContent value="settings">
              <PanelComingSoon title="Profile settings — P4" body="Edit your public creator page, social links, and tax details." />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({
  icon, label, value, sub, cta, onClick,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; cta?: string; onClick?: () => void;
}) {
  return (
    <Card className="border-slate-200">
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

function PanelComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-slate-200 mt-4">
      <CardContent className="py-12 text-center">
        <h3 className="text-lg font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">{body}</p>
      </CardContent>
    </Card>
  );
}
