import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { Plus, BookOpen, EyeOff, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { publicProductPath } from '@shared/public-assessment-routes';

type Course = {
  id: number;
  title: string;
  slug: string;
  isActive: boolean;
  visibility: 'public' | 'unlisted' | 'private';
  price: string;
  level: string;
  productType: 'assessment' | 'video_course' | 'ebook' | 'bundle';
  createdAt: string;
};

function courseState(course: Course) {
  if (course.isActive) return { label: 'Live', className: 'bg-slate-100 text-slate-800' };
  if (course.visibility === 'private') return { label: 'Draft', className: 'bg-slate-100 text-slate-700' };
  return { label: 'Submitted', className: 'bg-slate-100 text-slate-800' };
}

export default function CreatorCourses() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation('/creator/login');
  }, [authLoading, user, token, setLocation]);

  const { data: courses = [], isLoading, error } = useQuery<Course[]>({
    queryKey: ['/api/creator/courses'],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest('GET', '/api/creator/courses')).json(),
  });
  const { data: creator } = useQuery<{ status: string }>({
    queryKey: ['/api/me/creator'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/me/creator');
      if (!response.ok) throw new Error('Creator profile unavailable');
      return response.json();
    },
  });
  const submit = useMutation({
    mutationFn: async (courseId: number) => {
      const response = await apiRequest('PATCH', `/api/creator/courses/${courseId}`, { visibility: 'public' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Course could not be submitted');
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/creator/courses'] });
      toast({ title: 'Course submitted', description: 'It remains unavailable to learners until an Octamy admin approves it.' });
    },
    onError: (submitError: Error) => toast({ title: 'Submission unavailable', description: submitError.message }),
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
          {error && <Card className="mb-5 border-slate-200 bg-slate-50"><CardContent className="p-4 text-sm text-slate-800">We couldn't load your courses. Refresh the page to try again.</CardContent></Card>}
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
              {courses.map((c) => {
                const state = courseState(c);
                return (
                <div key={c.id} className="flex flex-col items-start justify-between gap-4 p-4 hover:bg-cream-deep sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">{c.title}</p>
                      <Badge variant="secondary" className={state.className}>{state.label}</Badge>
                      <Badge variant="outline" className="capitalize">{c.level}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      ₹{c.price} · {c.visibility === 'public' ? <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3"/>public</span> : <span className="inline-flex items-center gap-1"><EyeOff className="w-3 h-3"/>{c.visibility}</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Link href={`/creator/courses/${c.id}/curriculum`} className="text-sm text-slate-700 hover:underline">Edit curriculum →</Link>
                    {!c.isActive && c.visibility === 'private' && creator?.status === 'approved' && (
                      <Button size="sm" variant="outline" onClick={() => submit.mutate(c.id)} disabled={submit.isPending}>Submit for review</Button>
                    )}
                    {c.isActive && (
                      <Link href={publicProductPath(c.slug, c.productType)} className="text-sm text-slate-700 hover:underline">View →</Link>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
  );
}
