import { useState } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import { Bookmark, Trash2, Search } from 'lucide-react';

type Saved = { id: number; name: string; query: any; createdAt: string };

export default function RecruiterSavedSearches() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [skills, setSkills] = useState('');
  const [minScore, setMinScore] = useState(60);

  const list = useQuery<Saved[]>({
    queryKey: ['/api/recruiter/saved-searches'],
    queryFn: async () => (await apiRequest('GET', '/api/recruiter/saved-searches')).json(),
  });

  const save = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/recruiter/saved-searches', {
      name,
      query: { skills: skills.split(',').map((s) => s.trim()).filter(Boolean), minScore },
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter/saved-searches'] });
      setName(''); setSkills('');
      toast({ title: 'Search saved' });
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => (await apiRequest('DELETE', `/api/recruiter/saved-searches/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/recruiter/saved-searches'] }),
  });

  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO title="Saved searches" description="Reusable candidate filters for your team." path="/recruiter/saved-searches" />
      <Header />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <p className="text-xs uppercase tracking-wide text-slate-500">Recruiter</p>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Saved searches</h1>
          <p className="text-sm text-slate-600 mb-8">Pin filters you use often. Open one to jump back into candidate search.</p>

          <Card className="mb-6">
            <CardHeader className="pb-2"><CardTitle className="text-base">New saved search</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Name e.g. Senior React (Bangalore)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Skills (comma separated) e.g. React, TypeScript, AWS" value={skills} onChange={(e) => setSkills(e.target.value)} />
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-700">Min score %</label>
                <Input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-28" />
              </div>
              <div className="flex justify-end">
                <Button className="bg-slate-900 text-white" disabled={!name || save.isPending} onClick={() => save.mutate()}>
                  <Bookmark className="w-4 h-4 mr-2" /> {save.isPending ? 'Saving…' : 'Save search'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {list.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {list.data?.length === 0 && <p className="text-sm text-slate-500">No saved searches yet.</p>}
            {list.data?.map((s) => (
              <div key={s.id} className="flex items-center justify-between border border-cream-deep rounded-md p-4 bg-cream-soft hover:bg-cream-deep">
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {Array.isArray(s.query?.skills) && s.query.skills.length > 0 ? s.query.skills.join(', ') : 'Any skill'}
                    {typeof s.query?.minScore === 'number' ? ` · min ${s.query.minScore}%` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/recruiter/search?skills=${encodeURIComponent((s.query?.skills || []).join(','))}&minScore=${s.query?.minScore ?? ''}`}>
                    <Button size="sm" variant="outline"><Search className="w-3.5 h-3.5 mr-1.5"/> Open</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-600"/>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
