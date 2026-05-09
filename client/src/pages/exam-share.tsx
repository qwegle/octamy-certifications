import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEO } from '@/components/seo';
import { Lock, CheckCircle2, XCircle, Clock } from 'lucide-react';

type Inst = { id: number; title: string; durationMin: number; passingScore: number; requiresPassword: boolean; startsAt: string | null; endsAt: string | null };

export default function ExamShare() {
  const [, params] = useRoute<{ code: string }>('/x/:code');
  const code = params?.code ?? '';

  const [phase, setPhase] = useState<'gate' | 'live' | 'done'>('gate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<{ passed: boolean; scorePct: number } | null>(null);

  const { data: inst, isLoading } = useQuery<Inst>({
    queryKey: ['/api/x', code],
    enabled: !!code,
    queryFn: async () => (await apiRequest('GET', `/api/x/${code}`)).json(),
  });

  const startM = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/x/${code}/start`, { email, password: inst?.requiresPassword ? password : undefined })).json(),
    onSuccess: (data: any) => {
      setAttemptId(data.attemptId);
      setSecondsLeft((data.durationMin ?? inst?.durationMin ?? 30) * 60);
      setPhase('live');
    },
  });

  const submitM = useMutation({
    mutationFn: async (vars: { score: number; totalQuestions: number }) =>
      (await apiRequest('POST', `/api/exam-attempts/${attemptId}/submit`, { ...vars, answers: {} })).json(),
    onSuccess: (data: any) => {
      setResult({ passed: data.passed, scorePct: data.scorePct });
      setPhase('done');
    },
  });

  // Countdown + heartbeat
  useEffect(() => {
    if (phase !== 'live' || !attemptId) return;
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const beat = setInterval(() => { apiRequest('POST', `/api/exam-attempts/${attemptId}/heartbeat`).catch(() => {}); }, 30000);
    return () => { clearInterval(tick); clearInterval(beat); };
  }, [phase, attemptId]);

  useEffect(() => {
    if (phase === 'live' && secondsLeft === 0 && attemptId && !submitM.isPending) {
      submitM.mutate({ score: 0, totalQuestions: 1 });
    }
  }, [phase, secondsLeft]);

  if (isLoading) return <div className="min-h-screen grid place-items-center text-zinc-400">Loading…</div>;
  if (!inst) return <div className="min-h-screen grid place-items-center"><Card className="max-w-md"><CardContent className="p-6 text-center"><XCircle className="w-10 h-10 mx-auto text-red-500 mb-3" /><h1 className="font-semibold mb-2">Exam not found</h1><p className="text-sm text-zinc-500">This share-link is invalid or has expired.</p></CardContent></Card></div>;

  return (
    <div className="min-h-screen bg-zinc-50 grid place-items-center px-4 py-12">
      <SEO title={`${inst.title} — Exam`} description="Octamy share-link exam" />
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{inst.title}</span>
            {phase === 'live' && (
              <span className="text-sm font-mono flex items-center gap-1 text-zinc-500">
                <Clock className="w-4 h-4" />{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {phase === 'gate' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">{inst.durationMin} min · Passing {inst.passingScore}%</p>
              <div>
                <label className="text-sm font-medium">Your email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              {inst.requiresPassword && (
                <div>
                  <label className="text-sm font-medium flex items-center gap-1"><Lock className="w-3 h-3" /> Password</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <Button onClick={() => startM.mutate()} disabled={!email || startM.isPending} className="w-full">
                {startM.isPending ? 'Starting…' : 'Start exam'}
              </Button>
              {startM.error && <p className="text-sm text-red-500">{(startM.error as any).message}</p>}
            </div>
          )}
          {phase === 'live' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">This is a placeholder exam runner. Question rendering will be wired to the question bank in the next iteration.</p>
              <div className="flex gap-2">
                <Button onClick={() => submitM.mutate({ score: 1, totalQuestions: 1 })} variant="default">Submit (mock pass)</Button>
                <Button onClick={() => submitM.mutate({ score: 0, totalQuestions: 1 })} variant="outline">Submit (mock fail)</Button>
              </div>
            </div>
          )}
          {phase === 'done' && result && (
            <div className="text-center space-y-4">
              {result.passed ? <CheckCircle2 className="w-14 h-14 mx-auto text-green-500" /> : <XCircle className="w-14 h-14 mx-auto text-red-500" />}
              <h2 className="text-xl font-bold">{result.passed ? 'Passed' : 'Did not pass'}</h2>
              <p className="text-zinc-600">Score: {result.scorePct}%</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
