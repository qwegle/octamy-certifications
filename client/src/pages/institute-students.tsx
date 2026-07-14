import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Upload, Layers, ShieldCheck, LockKeyhole, BadgeCheck } from 'lucide-react';

type Cohort = { id: number; name: string; code: string | null; status: string; createdAt: string };
type Student = {
  id: number;
  name: string | null;
  email: string;
  rollNumber: string | null;
  status: string;
  cohortId: number;
  hasOctamyAccount: boolean;
  learnerConsent: boolean;
  hasActiveEvidence: boolean;
};
type SharingPolicy = {
  enabled: boolean;
  instituteStatus: string;
  activeAffiliations: number;
  eligibleLearners: number;
};
type InstituteProfile = { memberRole: 'owner' | 'admin' | 'teacher' | 'staff' };

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

  const instituteQ = useQuery<InstituteProfile>({
    queryKey: ['/api/me/institute'],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest('GET', '/api/me/institute')).json(),
  });

  const sharingQ = useQuery<SharingPolicy>({
    queryKey: ['/api/institute/recruiter-sharing'],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest('GET', '/api/institute/recruiter-sharing')).json(),
  });

  const updateSharing = useMutation({
    mutationFn: async (enabled: boolean) => (await apiRequest('PATCH', '/api/institute/recruiter-sharing', { enabled })).json(),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/institute/recruiter-sharing'] });
      toast({ title: 'Recruiter sharing updated', description: data.message });
    },
    onError: (e: any) => toast({
      title: 'Sharing preference unchanged',
      description: e.message || 'An institute admin or owner must update this setting.',
    }),
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
      toast({ title: 'Import complete', description: `${r.imported || 0} added · ${r.skipped || 0} skipped` });
    },
    onError: (e: any) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <DashboardLayout role="institute" title="Students & cohorts" breadcrumbs={[{ label: 'Institute', href: '/institute/dashboard' }, { label: 'Students & cohorts' }]}>
      <SEO title="Students & cohorts" description="Manage your students on Octamy." path="/institute/students" />
          <p className="text-sm text-slate-600 mb-6">Group your learners and invite them to verified assessments.</p>

          <Card className="mb-6 overflow-hidden border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="grid gap-5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white md:grid-cols-[1fr_auto] md:items-center md:p-6">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                    <ShieldCheck className="h-4 w-4" /> Consent-gated recruiter discovery
                  </div>
                  <h2 className="text-lg font-semibold">Allow eligible institute learners to appear in recruiter search</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    This setting authorizes your institute affiliation only. Every learner must also enable recruiter visibility in their own profile and hold at least one paid, active, unexpired Octamy credential. Your institute cannot opt in on a learner's behalf.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 md:min-w-56">
                  <div className="flex items-center justify-between gap-5">
                    <div>
                      <p className="text-sm font-semibold">Institute policy</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {sharingQ.data?.enabled ? 'Enabled' : 'Private by default'}
                      </p>
                    </div>
                    <Switch
                      checked={sharingQ.data?.enabled ?? false}
                      onCheckedChange={(enabled) => updateSharing.mutate(enabled)}
                      disabled={sharingQ.isLoading || updateSharing.isPending || !['owner', 'admin'].includes(instituteQ.data?.memberRole || '')}
                      aria-label="Allow eligible institute learners in recruiter search"
                    />
                  </div>
                  {!['owner', 'admin'].includes(instituteQ.data?.memberRole || '') && !instituteQ.isLoading ? (
                    <p className="mt-3 text-xs text-amber-200">An owner or admin controls this policy.</p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3 border-t border-slate-200 bg-white p-4 sm:grid-cols-3">
                <ConsentRule icon={<ShieldCheck className="h-4 w-4" />} label="Institute opt-in" ready={sharingQ.data?.enabled ?? false} />
                <ConsentRule icon={<LockKeyhole className="h-4 w-4" />} label="Learner opt-in" detail="Required per learner" />
                <ConsentRule icon={<BadgeCheck className="h-4 w-4" />} label="Current evidence" detail={`${sharingQ.data?.eligibleLearners ?? 0} eligible active learners`} />
              </div>
            </CardContent>
          </Card>

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
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <Badge variant="outline" className={s.learnerConsent ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                                  {s.learnerConsent ? 'Learner opted in' : 'Learner private'}
                                </Badge>
                                <Badge variant="outline" className={s.hasActiveEvidence ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                                  {s.hasActiveEvidence ? 'Evidence current' : 'No current paid evidence'}
                                </Badge>
                              </div>
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
      </DashboardLayout>
  );
}

function ConsentRule({ icon, label, ready, detail }: { icon: React.ReactNode; label: string; ready?: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-700 shadow-sm">{icon}</span>
      <div>
        <p className="text-xs font-semibold text-slate-900">{label}</p>
        <p className="text-[11px] text-slate-500">{detail || (ready ? 'Enabled' : 'Required')}</p>
      </div>
    </div>
  );
}
