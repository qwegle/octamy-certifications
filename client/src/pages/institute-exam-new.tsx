import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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

type Institute = { id: number; name: string; status: string };
type Bank = { id: number; name: string; questionCount: number; ownerType: string; ownerId: number | null };
type Cohort = { id: number; name: string; status: string };
type SubscriptionSummary = { institute: { plan: string; renewsAt: string | null } | null };
type ReviewPolicy = "immediate" | "after_final_attempt" | "after_window" | "score_only";

export default function InstituteExamNew() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [bankId, setBankId] = useState<number | null>(null);
  const [cohortId, setCohortId] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState(30);
  const [passingScore, setPassingScore] = useState(50);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [questionCount, setQuestionCount] = useState(20);
  const [retakeCooldownMin, setRetakeCooldownMin] = useState(0);
  const [reviewPolicy, setReviewPolicy] = useState<ReviewPolicy>("after_window");
  const [reviewReleaseAt, setReviewReleaseAt] = useState("");
  const [proctorMode, setProctorMode] = useState<"standard" | "browser_evidence">("standard");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: institute } = useQuery<Institute>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/institute")).json(),
  });

  const { data: banks } = useQuery<Bank[]>({
    queryKey: ["/api/question-banks"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/question-banks")).json(),
  });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/institute/cohorts"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/institute/cohorts")).json(),
  });

  const { data: subscription } = useQuery<SubscriptionSummary>({
    queryKey: ["/api/me/subscription"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/subscription")).json(),
  });
  const subscriptionLooksActive = !!subscription?.institute?.renewsAt
    && new Date(subscription.institute.renewsAt).getTime() > Date.now();

  const create = useMutation({
    mutationFn: async (status: "draft" | "live") => {
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
        ownerType: "institute",
        ownerId: institute!.id,
        status,
      };
      if (cohortId) body.cohortId = cohortId;
      if (startsAt) body.startsAt = new Date(startsAt).toISOString();
      if (endsAt) body.endsAt = new Date(endsAt).toISOString();
      if (reviewReleaseAt) body.reviewReleaseAt = new Date(reviewReleaseAt).toISOString();
      if (password) body.password = password;
      const r = await apiRequest("POST", "/api/exam-instances", body);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return { ...(await r.json()), requestedStatus: status };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/exam-instances"] });
      toast({
        title: data.requestedStatus === "live" ? "Exam published" : "Draft saved",
        description: data.excludedUnsupportedQuestions
          ? `${data.excludedUnsupportedQuestions} non-auto-graded bank item${data.excludedUnsupportedQuestions === 1 ? " was" : "s were"} excluded. Share link: ${data.shareUrl}`
          : data.requestedStatus === "live"
            ? "The private exam is ready. Send cohort invitations from the exams page."
            : "Complete funding and cohort setup before publishing.",
      });
      setLocation("/institute/exams");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <DashboardLayout
      role="institute"
      title="Create exam"
      breadcrumbs={[
        { label: "Institute", href: "/institute/dashboard" },
        { label: "Exams", href: "/institute/exams" },
        { label: "New" },
      ]}
    >
      <SEO title="Create exam" description="Create a new cohort exam." path="/institute/exams/new" />
      <Card className="border-cream-deep max-w-3xl">
          <CardHeader>
            <CardTitle className="text-base">Exam details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mid-term Java OOP" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div>
                <Label htmlFor="cohort">Candidate cohort</Label>
                <select
                  id="cohort"
                  value={cohortId ?? ""}
                  onChange={(event) => setCohortId(event.target.value ? Number(event.target.value) : null)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select later · draft only</option>
                  {cohorts.filter((cohort) => cohort.status !== "archived").map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs leading-5 text-slate-700">
                Published institute exams are private and delivered with a unique invitation for each cohort email. Your institute subscription funds every candidate attempt; learners are never charged.
              </p>
              <p className={`text-xs font-medium ${subscriptionLooksActive ? "text-slate-700" : "text-slate-700"}`}>
                {subscriptionLooksActive
                  ? `Workspace funding appears active until ${new Date(subscription!.institute!.renewsAt!).toLocaleDateString()}. The server verifies it again when publishing and starting.`
                  : "No current renewal is visible. You can save a draft now; publishing stays locked until the workspace subscription is active."}
              </p>
            </div>
            <div>
              <Label htmlFor="bank">Question bank <span className="text-red-500">*</span></Label>
              <select
                id="bank"
                value={bankId ?? ""}
                onChange={(e) => {
                  const nextBankId = e.target.value ? Number(e.target.value) : null;
                  setBankId(nextBankId);
                  const bank = banks?.find((candidate) => candidate.id === nextBankId);
                  if (bank) setQuestionCount(Math.max(1, Math.min(50, bank.questionCount)));
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select a question bank —</option>
                {(banks ?? []).filter((b) => (b.questionCount ?? 0) > 0).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.questionCount} {b.questionCount === 1 ? "question" : "questions"})
                  </option>
                ))}
              </select>
              {(banks ?? []).length === 0 && (
                <p className="text-xs text-slate-600 mt-1">
                  No question banks found. <a href="/institute/question-banks" className="underline">Create or import one first</a>.
                </p>
              )}
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
                    const next = e.target.value as ReviewPolicy;
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
                  <p className="mt-1 text-xs text-slate-600">Leave blank to release when the exam ends. It can never be earlier than the closing time.</p>
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
                <option value="browser_evidence">Browser evidence · adds tab, focus, fullscreen and paste events</option>
              </select>
              <p className="text-xs leading-5 text-slate-600">
                {proctorMode === "browser_evidence"
                  ? "Candidates see and accept a disclosure before starting. Events are shown to reviewers as context only; Octamy does not access camera, microphone, screen contents or clipboard contents, and does not issue an automated cheating verdict."
                  : "Answers are autosaved and connection interruptions are recorded so candidates can recover after a refresh or temporary outage."}
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
              <Label htmlFor="pwd">Password (optional)</Label>
              <Input id="pwd" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for open access" />
            </div>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                onClick={() => create.mutate("draft")}
                disabled={!title || title.length < 3 || !institute?.id || !bankId || questionCount < 1 || create.isPending}
                variant="outline"
              >
                {create.isPending ? "Saving…" : "Save draft"}
              </Button>
              <Button
                onClick={() => create.mutate("live")}
                disabled={!title || title.length < 3 || !institute?.id || !bankId || !cohortId || questionCount < 1 || (reviewPolicy === "after_window" && !endsAt && !reviewReleaseAt) || create.isPending}
                className="bg-slate-900 text-white"
              >
                {create.isPending ? "Publishing…" : "Publish private exam"}
              </Button>
              <Button variant="outline" onClick={() => setLocation("/institute/exams")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
    </DashboardLayout>
  );
}
