import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEO } from '@/components/seo';
import { Lock, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type Inst = { id: number; title: string; durationMin: number; passingScore: number; requiresPassword: boolean; startsAt: string | null; endsAt: string | null };
type Question = { id: number; question: string; options: string[]; type: string; format: string; imageUrl: string | null; codeLanguage: string | null; timeLimitSec: number | null; maxPoints: number };
type QuestionsPayload = { attemptId: number; durationMin: number; questions: Question[] };

export default function ExamShare() {
  const [, params] = useRoute<{ code: string }>('/x/:code');
  const code = params?.code ?? '';

  const [phase, setPhase] = useState<'gate' | 'live' | 'done'>('gate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<{ passed: boolean; scorePct: number; score: number; totalQuestions: number } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { data: inst, isLoading } = useQuery<Inst>({
    queryKey: ['/api/x', code],
    enabled: !!code,
    queryFn: async () => (await apiRequest('GET', `/api/x/${code}`)).json(),
  });

  const startM = useMutation({
    mutationFn: async () => (await apiRequest('POST', `/api/x/${code}/start`, { email, password: inst?.requiresPassword ? password : undefined })).json(),
    onSuccess: async (data: any) => {
      setAttemptId(data.attemptId);
      setSecondsLeft((data.durationMin ?? inst?.durationMin ?? 30) * 60);
      // Load questions
      try {
        const qRes = await apiRequest('GET', `/api/exam-attempts/${data.attemptId}/questions`);
        if (!qRes.ok) {
          const j = await qRes.json().catch(() => ({}));
          setLoadError(j.message || 'Failed to load questions.');
          return;
        }
        const payload: QuestionsPayload = await qRes.json();
        setQuestions(payload.questions);
        setPhase('live');
      } catch (e: any) {
        setLoadError(e.message || 'Failed to load questions.');
      }
    },
  });

  const submitM = useMutation({
    mutationFn: async () =>
      (await apiRequest('POST', `/api/exam-attempts/${attemptId}/submit`, { answers })).json(),
    onSuccess: (data: any) => {
      setResult({ passed: data.passed, scorePct: data.scorePct, score: data.score, totalQuestions: data.totalQuestions });
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
      submitM.mutate();
    }
  }, [phase, secondsLeft]);

  if (isLoading) return <div className="min-h-screen grid place-items-center text-zinc-400">Loading…</div>;
  if (!inst) return <div className="min-h-screen grid place-items-center"><Card className="max-w-md"><CardContent className="p-6 text-center"><XCircle className="w-10 h-10 mx-auto text-red-500 mb-3" /><h1 className="font-semibold mb-2">Exam not found</h1><p className="text-sm text-zinc-500">This share-link is invalid or has expired.</p></CardContent></Card></div>;

  const current = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-cream-deep grid place-items-center px-4 py-12">
      <SEO title={`${inst.title} — Exam`} description="Octamy share-link exam" />
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{inst.title}</span>
            {phase === 'live' && (
              <span className="text-sm font-mono flex items-center gap-1 text-zinc-700 bg-cream px-2 py-1 rounded-md">
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
              {loadError && <p className="text-sm text-red-500">{loadError}</p>}
            </div>
          )}
          {phase === 'live' && current && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Question {currentIdx + 1} of {questions.length}</span>
                <span>{answeredCount} answered</span>
              </div>
              <div className="h-1 bg-cream rounded-full overflow-hidden">
                <div className="h-full bg-slate-900 transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-4 whitespace-pre-wrap">{current.question}</h3>
                {current.imageUrl && <img src={current.imageUrl} alt="" className="mb-4 rounded-md max-h-64" />}
                <div className="space-y-2">
                  {current.options.map((opt, i) => {
                    const selected = answers[current.id] === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [current.id]: i }))}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-cream-deep bg-white hover:border-slate-400'
                        }`}
                      >
                        <span className="font-mono text-xs mr-3 opacity-70">{String.fromCharCode(65 + i)}</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-cream-deep">
                <Button variant="outline" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                {currentIdx < questions.length - 1 ? (
                  <Button onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={() => submitM.mutate()} disabled={submitM.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                    {submitM.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting…</> : 'Submit exam'}
                  </Button>
                )}
              </div>
              {submitM.error && <p className="text-sm text-red-500">{(submitM.error as any).message}</p>}
            </div>
          )}
          {phase === 'done' && result && (
            <div className="text-center space-y-4 py-6">
              {result.passed ? <CheckCircle2 className="w-14 h-14 mx-auto text-green-500" /> : <XCircle className="w-14 h-14 mx-auto text-red-500" />}
              <h2 className="text-2xl font-bold">{result.passed ? 'Passed' : 'Did not pass'}</h2>
              <p className="text-zinc-600">Score: <span className="font-semibold">{result.scorePct}%</span> ({result.score} / {result.totalQuestions})</p>
              <p className="text-xs text-zinc-500">Passing mark was {inst.passingScore}%.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
