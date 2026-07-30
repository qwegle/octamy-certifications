import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";

type Instance = {
  id: number;
  title: string;
  shareCode: string;
  durationMin: number;
  passingScore: number;
  maxAttempts: number;
  questionCount: number;
  retakeCooldownMin: number;
  reviewPolicy: "immediate" | "after_final_attempt" | "after_window" | "score_only";
  reviewReleaseAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  bankId: number | null;
  proctorMode: "standard" | "browser_evidence";
};
type Bank = { id: number; name: string; questionCount: number };

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 16);
}

export default function InstituteExamEdit() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/institute/exams/:id/edit");
  const examId = Number(params?.id);
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [bankId, setBankId] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState(30);
  const [passingScore, setPassingScore] = useState(50);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [questionCount, setQuestionCount] = useState(20);
  const [retakeCooldownMin, setRetakeCooldownMin] = useState(0);
  const [reviewPolicy, setReviewPolicy] = useState<Instance["reviewPolicy"]>("after_window");
  const [reviewReleaseAt, setReviewReleaseAt] = useState("");
  const [proctorMode, setProctorMode] = useState<"standard" | "browser_evidence">("standard");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"draft" | "live" | "closed">("live");

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: institute } = useQuery<{ id: number }>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/institute")).json(),
  });

  const { data: instance, isLoading } = useQuery<Instance>({
    queryKey: ["/api/exam-instances", institute?.id, examId],
    enabled: !!institute?.id && !!examId,
    queryFn: async () => {
      const all: Instance[] = await (await apiRequest("GET", `/api/exam-instances?ownerType=institute&ownerId=${institute!.id}`)).json();
      const found = all.find((x) => x.id === examId);
      if (!found) throw new Error("Exam not found");
      return found;
    },
  });

  const { data: banks } = useQuery<Bank[]>({
    queryKey: ["/api/question-banks"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/question-banks")).json(),
  });

  useEffect(() => {
    if (!instance) return;
    setTitle(instance.title);
    setBankId(instance.bankId);
    setDurationMin(instance.durationMin);
    setPassingScore(instance.passingScore);
    setMaxAttempts(instance.maxAttempts);
    setQuestionCount(instance.questionCount || 1);
    setRetakeCooldownMin(instance.retakeCooldownMin || 0);
    setReviewPolicy(instance.reviewPolicy || "score_only");
    setReviewReleaseAt(toLocalInputValue(instance.reviewReleaseAt));
    setProctorMode(instance.proctorMode || "standard");
    setStartsAt(toLocalInputValue(instance.startsAt));
    setEndsAt(toLocalInputValue(instance.endsAt));
    setStatus((instance.status as any) || "live");
  }, [instance]);

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        bankId,
        durationMin: Number(durationMin),
        passingScore: Number(passingScore),
        maxAttempts: Number(maxAttempts),
        questionCount: Number(questionCount),
        retakeCooldownMin: Number(retakeCooldownMin),
        reviewPolicy,
        proctorMode,
        status,
      };
      body.startsAt = startsAt ? new Date(startsAt).toISOString() : null;
      body.endsAt = endsAt ? new Date(endsAt).toISOString() : null;
      body.reviewReleaseAt = reviewReleaseAt ? new Date(reviewReleaseAt).toISOString() : null;
      if (password) body.password = password;
      const r = await apiRequest("PATCH", `/api/exam-instances/${examId}`, body);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-instances"] });
      toast({ title: "Saved" });
      setLocation("/institute/exams");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <DashboardLayout
      role="institute"
      title="Edit exam"
      breadcrumbs={[
        { label: "Institute", href: "/institute/dashboard" },
        { label: "Exams", href: "/institute/exams" },
        { label: "Edit" },
      ]}
    >
      <SEO title="Edit exam · Institute" path={`/institute/exams/${examId}/edit`} />
      {isLoading || !instance ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <Card className="border-cream-deep max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base">Exam details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bank">Question bank</Label>
              <select
                id="bank"
                value={bankId ?? ""}
                onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {(banks ?? []).filter((b) => (b.questionCount ?? 0) > 0).map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.questionCount} {b.questionCount === 1 ? "question" : "questions"})</option>
                ))}
              </select>
              {!bankId && <p className="text-xs text-slate-600 mt-1">Without a bank, this exam will not be runnable.</p>}
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="dur">Duration (min)</Label>
                <Input id="dur" type="number" min={5} max={360} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="pass">Passing %</Label>
                <Input id="pass" type="number" min={10} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="att">Max attempts</Label>
                <Input id="att" type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="question-count">Questions</Label>
                <Input id="question-count" type="number" min={1} max={500} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div>
                <Label htmlFor="review-policy">Answer review</Label>
                <select
                  id="review-policy"
                  value={reviewPolicy}
                  onChange={(e) => {
                    const next = e.target.value as Instance["reviewPolicy"];
                    setReviewPolicy(next);
                    if (next !== "after_window") setReviewReleaseAt("");
                  }}
                  className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  <option value="after_window">After the exam window closes · recommended</option>
                  <option value="after_final_attempt">After the learner's final permitted attempt</option>
                  <option value="immediate">Immediately after every submission</option>
                  <option value="score_only">Score only · never show answer keys</option>
                </select>
              </div>
              {reviewPolicy === "after_window" && (
                <div>
                  <Label htmlFor="review-release">Review release (optional)</Label>
                  <Input id="review-release" type="datetime-local" value={reviewReleaseAt} onChange={(e) => setReviewReleaseAt(e.target.value)} />
                  <p className="mt-1 text-xs text-slate-600">Leave blank to release when the exam ends.</p>
                </div>
              )}
              <div>
                <Label htmlFor="retake-cooldown">Retake cooldown (minutes)</Label>
                <Input id="retake-cooldown" type="number" min={0} max={43200} value={retakeCooldownMin} onChange={(e) => setRetakeCooldownMin(Number(e.target.value))} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <Label htmlFor="proctor-mode">Exam evidence mode</Label>
              <select
                id="proctor-mode"
                value={proctorMode}
                onChange={(e) => setProctorMode(e.target.value as "standard" | "browser_evidence")}
                className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="standard">Standard assessment · autosave and connection recovery</option>
                <option value="browser_evidence">Browser evidence · tab, focus, fullscreen and paste events</option>
              </select>
              <p className="text-xs leading-5 text-slate-600">
                Browser evidence is disclosed to candidates and supports human review only. It does not use webcam, microphone, screen recording or AI misconduct scoring. Each attempt retains the mode active when it started.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start">Starts at (optional)</Label>
                <Input id="start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="end">Ends at (optional)</Label>
                <Input id="end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="pwd">New password (optional — leave blank to keep)</Label>
              <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => save.mutate()} disabled={!title || questionCount < 1 || (reviewPolicy === "after_window" && !endsAt && !reviewReleaseAt) || save.isPending} className="bg-slate-900 text-white">
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="outline" onClick={() => setLocation("/institute/exams")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
