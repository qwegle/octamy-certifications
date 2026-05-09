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
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Upload, Layers } from 'lucide-react';

type Cohort = { id: number; name: string; code: string | null; status: string; createdAt: string };
type Student = { id: number; name: string | null; email: string; rollNumber: string | null; status: string; cohortId: number };

export default function InstituteStudents() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation('/institute/login');
  }, [authLoading, user, token, setLocation]);

  const cohortsQ = useQuery<Cohort[]>({
    queryKey: ['/api/institute/cohorts'],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest('GET', '/api/institute/cohorts')).json(),
  });

  const [activeCohortId, setActiveCohortId] = useState<number | null>(null);
  useEffect(() => {
    if (cohortsQ.data && cohortsQ.data.length > 0 && !activeCohortId) setActiveCohortId(cohortsQ.data[0].id);
  }, [cohortsQ.data, activeCohortId]);

  const studentsQ = useQuery<Student[]>({
    queryKey: ['/api/institute/students', activeCohortId],
    enabled: !!activeCohortId,
    queryFn: async () => (await apiRequest('GET', `/api/institute/students?cohortId=${activeCohortId}`)).json(),
  });

  const [newCohort, setNewCohort] = useState({ name: '', code: '' });
  const createCohort = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/institute/cohorts', newCohort)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/institute/cohorts'] });
      setNewCohort({ name: '', code: '' });
      toast({ title: 'Cohort created' });
    },
  });

  const [newStudent, setNewStudent] = useState({ name: '', email: '', rollNumber: '' });
  const addStudent = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/institute/students', { ...newStudent, cohortId: activeCohortId })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/institute/students', activeCohortId] });
      setNewStudent({ name: '', email: '', rollNumber: '' });
      toast({ title: 'Student added' });
    },
    onError: (e: any) => toast({ title: 'Could not add', description: e.message, variant: 'destructive' }),
  });

  const [csv, setCsv] = useState('');
  const importCsv = useMutation({
    mutationFn: async () => (await apiRequest('POST', '/api/institute/students/import', { cohortId: activeCohortId, csv })).json(),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/institute/students', activeCohortId] });
      setCsv('');
      toast({ title: 'Import complete', description: `${r.created || 0} added · ${r.skipped || 0} skipped` });
    },
    onError: (e: any) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Students & cohorts" description="Manage your students on Octamy." path="/institute/students" />
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <p className="text-xs uppercase tracking-wide text-slate-500">Institute</p>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Students & cohorts</h1>
          <p className="text-sm text-slate-600 mb-8">Group your learners and invite them to verified assessments.</p>

          <div className="grid lg:grid-cols-[260px_1fr] gap-6">
            <aside className="space-y-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4"/>Cohorts</CardTitle></CardHeader>
                <CardContent className="space-y-1 px-2 pb-3">
                  {cohortsQ.isLoading && <p className="text-xs text-slate-500 px-2">Loading…</p>}
                  {cohortsQ.data?.length === 0 && <p className="text-xs text-slate-500 px-2">None yet — create one below.</p>}
                  {cohortsQ.data?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCohortId(c.id)}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-sm ${activeCohortId === c.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      {c.name} {c.code && <span className="opacity-60 text-xs">({c.code})</span>}
                    </button>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">New cohort</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Input placeholder="Name e.g. CS-2026" value={newCohort.name} onChange={(e) => setNewCohort({ ...newCohort, name: e.target.value })} />
                  <Input placeholder="Code (optional)" value={newCohort.code} onChange={(e) => setNewCohort({ ...newCohort, code: e.target.value })} />
                  <Button size="sm" className="w-full bg-slate-900 text-white" disabled={!newCohort.name || createCohort.isPending} onClick={() => createCohort.mutate()}>
                    {createCohort.isPending ? 'Creating…' : 'Create cohort'}
                  </Button>
                </CardContent>
              </Card>
            </aside>

            <section className="space-y-6">
              {!activeCohortId ? (
                <Card><CardContent className="py-16 text-center text-sm text-slate-500">Create a cohort to start adding students.</CardContent></Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4"/>Add a student</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <Input placeholder="Name" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} />
                        <Input type="email" placeholder="Email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} />
                        <Input placeholder="Roll #" value={newStudent.rollNumber} onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })} />
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button size="sm" className="bg-slate-900 text-white" disabled={!newStudent.email || addStudent.isPending} onClick={() => addStudent.mutate()}>
                          {addStudent.isPending ? 'Adding…' : 'Add student'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4"/>Bulk import (CSV)</CardTitle></CardHeader>
                    <CardContent>
                      <Label className="text-xs text-slate-500">One row per student: <code>name,email,rollNumber</code></Label>
                      <Textarea rows={5} placeholder={'Aanya Sharma,aanya@example.com,CS001\nRohan Patel,rohan@example.com,CS002'} value={csv} onChange={(e) => setCsv(e.target.value)} />
                      <div className="flex justify-end mt-3">
                        <Button size="sm" className="bg-slate-900 text-white" disabled={!csv.trim() || importCsv.isPending} onClick={() => importCsv.mutate()}>
                          {importCsv.isPending ? 'Importing…' : 'Import CSV'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Students</CardTitle></CardHeader>
                    <CardContent>
                      {studentsQ.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
                      {studentsQ.data?.length === 0 && <p className="text-sm text-slate-500">No students in this cohort yet.</p>}
                      <div className="divide-y divide-slate-100">
                        {studentsQ.data?.map((s) => (
                          <div key={s.id} className="py-2 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{s.name || s.email}</p>
                              <p className="text-xs text-slate-500">{s.email}{s.rollNumber ? ` · ${s.rollNumber}` : ''}</p>
                            </div>
                            <Badge variant="outline" className="capitalize">{s.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
