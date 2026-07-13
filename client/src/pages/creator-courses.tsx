import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { Plus, BookOpen, EyeOff, Eye } from 'lucide-react';

type Course = {
  id: number;
  title: string;
  slug: string;
  isActive: boolean;
  visibility: 'public' | 'unlisted' | 'private';
  price: string;
  level: string;
  createdAt: string;
};

export default function CreatorCourses() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation('/creator/login');
  }, [authLoading, user, token, setLocation]);

  const { data: courses = [], isLoading, error } = useQuery<Course[]>({
    queryKey: ['/api/creator/courses'],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest('GET', '/api/creator/courses')).json(),
  });

  return (
    <DashboardLayout
      role="creator"
      title="My courses"
      description="Manage draft and published assessments you own."
      breadcrumbs={[{ label: 'Creator', href: '/creator/dashboard' }, { label: 'My courses' }]}
      actions={<Button onClick={() => setLocation('/creator/courses/new')} className="bg-slate-900 hover:bg-black text-white"><Plus className="w-4 h-4 mr-2" /> New course</Button>}
    >
      <SEO title="My courses" description="Manage your Octamy courses." path="/creator/courses" />
        <div>
          {error && <Card className="mb-5 border-rose-200 bg-rose-50"><CardContent className="p-4 text-sm text-rose-800">We couldn't load your courses. Refresh the page to try again.</CardContent></Card>}
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading courses">{[1,2,3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />)}</div>
          ) : courses.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">No courses yet</h3>
                <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                  Submit your first course for review. Once approved by the Octamy team, it goes live with verifiable certificates.
                </p>
                <Button onClick={() => setLocation('/creator/courses/new')} className="mt-5 bg-slate-900 text-white">Create your first course</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-cream-soft">
              {courses.map((c) => (
                <div key={c.id} className="flex flex-col items-start justify-between gap-4 p-4 hover:bg-cream-deep sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">{c.title}</p>
                      {!c.isActive && <Badge variant="secondary" className="text-amber-700 bg-amber-100">Pending review</Badge>}
                      {c.isActive && <Badge className="bg-emerald-100 text-emerald-800">Live</Badge>}
                      <Badge variant="outline" className="capitalize">{c.level}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      ₹{c.price} · {c.visibility === 'public' ? <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3"/>public</span> : <span className="inline-flex items-center gap-1"><EyeOff className="w-3 h-3"/>{c.visibility}</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Link href={`/creator/courses/${c.id}/curriculum`} className="text-sm text-slate-700 hover:underline">Edit curriculum →</Link>
                    {c.isActive && (
                      <Link href={`/exam/${c.slug}`} className="text-sm text-slate-700 hover:underline">View →</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
  );
}
