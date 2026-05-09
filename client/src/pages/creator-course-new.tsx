import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';

type Category = { id: number; name: string; slug: string };

export default function CreatorCourseNew() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation('/creator/login');
  }, [authLoading, user, token, setLocation]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => (await apiRequest('GET', '/api/categories')).json(),
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: 0,
    duration: 30,
    passingScore: 60,
    price: 199,
    level: 'novice' as 'novice' | 'intermediate' | 'advanced' | 'expert',
    visibility: 'public' as 'public' | 'unlisted' | 'private',
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/creator/courses', form);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create course');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/creator/courses'] });
      toast({ title: 'Course submitted', description: 'Our team reviews new courses within 24h.' });
      setLocation('/creator/courses');
    },
    onError: (e: Error) => toast({ title: 'Could not create', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="New course" description="Create a new course on Octamy." path="/creator/courses/new" />
      <Header />
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <p className="text-xs uppercase tracking-wide text-slate-500">Creator</p>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">New course</h1>
          <p className="text-sm text-slate-600 mb-6">Submit a course for review. Once approved it will be visible to learners.</p>
          <Card>
            <CardHeader><CardTitle className="text-base">Course details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Advanced React Patterns" />
              </Field>
              <Field label="Description">
                <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will the learner walk away knowing?" />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Category">
                  <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
                    <option value={0}>Select a category…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Level">
                  <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as any })}>
                    <option value="novice">Novice</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Duration (mins)">
                  <Input type="number" min={5} max={600} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
                </Field>
                <Field label="Passing score (%)">
                  <Input type="number" min={10} max={100} value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} />
                </Field>
                <Field label="Price (₹)">
                  <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Visibility">
                <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as any })}>
                  <option value="public">Public — listed in catalog</option>
                  <option value="unlisted">Unlisted — direct link only</option>
                  <option value="private">Private — only you</option>
                </select>
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setLocation('/creator/courses')}>Cancel</Button>
                <Button
                  className="bg-slate-900 hover:bg-black text-white"
                  disabled={create.isPending || !form.title || !form.description || !form.categoryId}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? 'Submitting…' : 'Submit for review'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
