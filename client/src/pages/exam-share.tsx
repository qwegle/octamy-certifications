import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "@/components/seo";
import { resyncAuthoritativeExamTimer } from "@/lib/exam-timer";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Maximize,
  Save,
  ShieldCheck,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

type ProctorMode = "standard" | "browser_evidence";

type Inst = {
  id: number;
  title: string;
  durationMin: number;
  passingScore: number;
  maxAttempts: number;
  questionCount: number;
  reviewPolicy: "immediate" | "after_final_attempt" | "after_window" | "score_only";
  reviewAvailableAt: string | null;
  retakeCooldownMin: number;
  requiresPassword: boolean;
  cohortRestricted: boolean;
  accessMode: "public_link" | "cohort_invite";
  invitationEmail: string | null;
  candidateCharge: boolean | null;
  startsAt: string | null;
  endsAt: string | null;
  proctorMode: ProctorMode;
  evidenceDisclosure: string;
};

type Question = {
  id: number;
  question: string;
  options: string[];
  type: string;
  format: string;
  imageUrl: string | null;
  codeLanguage: string | null;
  timeLimitSec: number | null;
  maxPoints: number;
};

type QuestionsPayload = {
  attemptId: number;
  durationMin: number;
  startedAt: string;
  serverTime: string;
  remainingSeconds: number;
  savedAnswers: Record<string, number>;
  lastAutosaveAt: string | null;
  proctorMode: ProctorMode;
  excludedUnsupportedQuestions: number;
  questions: Question[];
};

type EvidenceEvent = {
  clientEventId: string;
  eventType:
    | "session_started"
    | "session_resumed"
    | "network_offline"
    | "network_online"
    | "visibility_hidden"
    | "visibility_visible"
    | "window_blur"
    | "window_focus"
    | "fullscreen_enter"
    | "fullscreen_exit"
    | "fullscreen_unavailable"
    | "paste";
  clientAt: string;
  metadata?: { durationMs?: number; reason?: string };
};

type RecoveryState = {
  attemptId: number;
  accessToken: string;
  accessExpiresAt: string;
  startedAt: string;
  proctorMode: ProctorMode;
  answers: Record<number, number>;
  pendingEvents: EvidenceEvent[];
};

type ExamResult = {
  passed: boolean;
  scorePct: number;
  score: number;
  totalPoints: number;
  totalQuestions: number;
  correctAnswers?: number;
  answeredQuestions?: number;
  timedOut?: boolean;
};

type ExamReview = {
  result: ExamResult;
  questions: Array<Question & {
    submittedAnswer: number | string | number[] | null;
    correctAnswer: number;
    correctOption: string | null;
    isCorrect: boolean;
    negativeMarks: number;
    awardedPoints: number;
    explanation: string | null;
  }>;
};

class AttemptApiError extends Error {
  status: number;
  payload: any;
  constructor(message: string, status: number, payload: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function attemptRequest<T>(
  method: "GET" | "POST",
  url: string,
  accessToken: string,
  body?: unknown,
  keepalive = false,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "include",
    keepalive,
    headers: {
      "X-Attempt-Token": accessToken,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new AttemptApiError(payload.message || `Request failed (${response.status})`, response.status, payload);
  return payload as T;
}

function eventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replaceAll("-", "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

function readInvitationLink(): { token: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("invite")?.trim() ?? "";
  const email = params.get("email")?.trim().toLowerCase() ?? "";
  return token && email ? { token, email } : null;
}

export default function ExamShare() {
  const [, params] = useRoute<{ code: string }>("/x/:code");
  const code = params?.code ?? "";
  const recoveryKey = `octamy.exam.recovery.${code}`;
  const invitationLinkRef = useRef<{ token: string; email: string } | null>(readInvitationLink());
  const invitationLink = invitationLinkRef.current;

  const [phase, setPhase] = useState<"gate" | "loading" | "live" | "done">("gate");
  const [email, setEmail] = useState(invitationLink?.email ?? "");
  const [password, setPassword] = useState("");
  const [consented, setConsented] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [review, setReview] = useState<ExamReview | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncState, setSyncState] = useState<"saved" | "saving" | "pending" | "offline">(
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "saved",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeProctorMode, setActiveProctorMode] = useState<ProctorMode>("standard");
  const [excludedQuestionCount, setExcludedQuestionCount] = useState(0);

  const attemptIdRef = useRef<number | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const accessExpiresAtRef = useRef<string | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const deadlineRef = useRef<number>(0);
  const answersRef = useRef<Record<number, number>>({});
  const eventsRef = useRef<EvidenceEvent[]>([]);
  const proctorModeRef = useRef<ProctorMode>("standard");
  const syncInFlightRef = useRef(false);
  const submittingRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineSinceRef = useRef<number | null>(typeof navigator !== "undefined" && !navigator.onLine ? Date.now() : null);
  const recoveryAttemptedRef = useRef(false);
  const autoSubmitRef = useRef(false);

  const resyncTimer = useCallback((remainingSeconds: unknown) => {
    const timer = resyncAuthoritativeExamTimer(remainingSeconds);
    if (!timer) return false;
    deadlineRef.current = timer.deadlineMs;
    setSecondsLeft(timer.remainingSeconds);
    return true;
  }, []);

  const { data: inst, isLoading, error: instanceError } = useQuery<Inst>({
    queryKey: ["/api/x", code, invitationLink?.email ?? "public"],
    enabled: !!code,
    queryFn: async () => {
      const response = await fetch(`/api/x/${code}`, {
        credentials: "include",
        headers: invitationLink ? {
          "X-Exam-Invite-Token": invitationLink.token,
          "X-Exam-Invite-Email": invitationLink.email,
        } : undefined,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "This assessment is unavailable");
      return payload as Inst;
    },
    retry: false,
  });

  useEffect(() => {
    if (!invitationLink || typeof window === "undefined") return;
    // Retain the bearer token in component memory for the start handshake, but
    // remove it from the address bar/history before analytics or screenshots.
    window.history.replaceState(window.history.state, document.title, window.location.pathname);
  }, [invitationLink]);

  const persistRecovery = useCallback(() => {
    if (!attemptIdRef.current || !accessTokenRef.current || !accessExpiresAtRef.current || !startedAtRef.current) return;
    const value: RecoveryState = {
      attemptId: attemptIdRef.current,
      accessToken: accessTokenRef.current,
      accessExpiresAt: accessExpiresAtRef.current,
      startedAt: startedAtRef.current,
      proctorMode: proctorModeRef.current,
      answers: answersRef.current,
      pendingEvents: eventsRef.current.slice(-100),
    };
    try { localStorage.setItem(recoveryKey, JSON.stringify(value)); } catch { /* storage can be unavailable */ }
  }, [recoveryKey]);

  const queueEvent = useCallback((eventType: EvidenceEvent["eventType"], metadata?: EvidenceEvent["metadata"]) => {
    const browserOnly = !["session_started", "session_resumed", "network_offline", "network_online"].includes(eventType);
    if (browserOnly && proctorModeRef.current !== "browser_evidence") return;
    eventsRef.current = [...eventsRef.current, { clientEventId: eventId(), eventType, clientAt: new Date().toISOString(), metadata }].slice(-100);
    persistRecovery();
  }, [persistRecovery]);

  const syncNow = useCallback(async (keepalive = false) => {
    const activeAttemptId = attemptIdRef.current;
    const token = accessTokenRef.current;
    if (!activeAttemptId || !token) return false;
    if (!navigator.onLine) {
      setSyncState("offline");
      persistRecovery();
      return false;
    }
    if (syncInFlightRef.current) return false;

    syncInFlightRef.current = true;
    setSyncState("saving");
    const batch = eventsRef.current.slice(0, 50);
    try {
      const data = await attemptRequest<{ savedAt: string | null; remainingSeconds: number }>(
        "POST",
        `/api/exam-attempts/${activeAttemptId}/sync`,
        token,
        { answers: answersRef.current, events: batch },
        keepalive,
      );
      const sentIds = new Set(batch.map((event) => event.clientEventId));
      eventsRef.current = eventsRef.current.filter((event) => !sentIds.has(event.clientEventId));
      setLastSavedAt(data.savedAt || new Date().toISOString());
      setSyncState("saved");
      resyncTimer(data.remainingSeconds);
      persistRecovery();
      if (eventsRef.current.length > 0 && !keepalive) {
        window.setTimeout(() => { void syncNow(); }, 25);
      }
      return true;
    } catch (error) {
      if (error instanceof AttemptApiError && error.status === 409 && error.payload?.result) {
        setResult(error.payload.result);
        setPhase("done");
        try { localStorage.removeItem(recoveryKey); } catch { /* ignore */ }
        return true;
      }
      setSyncState(navigator.onLine ? "pending" : "offline");
      persistRecovery();
      return false;
    } finally {
      syncInFlightRef.current = false;
    }
  }, [persistRecovery, recoveryKey, resyncTimer]);

  const loadLiveSession = useCallback(async (recovery: RecoveryState, resumed: boolean) => {
    setPhase("loading");
    setMessage(null);
    attemptIdRef.current = recovery.attemptId;
    accessTokenRef.current = recovery.accessToken;
    accessExpiresAtRef.current = recovery.accessExpiresAt;
    startedAtRef.current = recovery.startedAt;
    proctorModeRef.current = recovery.proctorMode;
    setActiveProctorMode(recovery.proctorMode);
    answersRef.current = recovery.answers || {};
    eventsRef.current = recovery.pendingEvents || [];
    setAttemptId(recovery.attemptId);
    setAccessToken(recovery.accessToken);

    try {
      const payload = await attemptRequest<QuestionsPayload>(
        "GET",
        `/api/exam-attempts/${recovery.attemptId}/questions`,
        recovery.accessToken,
      );
      const mergedAnswers = { ...(payload.savedAnswers || {}), ...(recovery.answers || {}) } as Record<number, number>;
      const startedAt = payload.startedAt || recovery.startedAt;
      if (!resyncTimer(payload.remainingSeconds)) {
        throw new Error("The server did not provide a valid exam timer. Please retry this session.");
      }
      startedAtRef.current = startedAt;
      proctorModeRef.current = payload.proctorMode;
      setActiveProctorMode(payload.proctorMode);
      answersRef.current = mergedAnswers;
      setAnswers(mergedAnswers);
      setQuestions(payload.questions);
      setExcludedQuestionCount(payload.excludedUnsupportedQuestions || 0);
      setLastSavedAt(payload.lastAutosaveAt);
      const firstUnanswered = payload.questions.findIndex((question) => mergedAnswers[question.id] === undefined);
      setCurrentIdx(firstUnanswered >= 0 ? firstUnanswered : 0);
      queueEvent(resumed ? "session_resumed" : "session_started");
      setPhase("live");
      persistRecovery();
      void syncNow();
    } catch (error) {
      if (error instanceof AttemptApiError && error.message === "Already submitted") {
        try {
          const completed = await attemptRequest<ExamResult>(
            "POST",
            `/api/exam-attempts/${recovery.attemptId}/submit`,
            recovery.accessToken,
            { answers: recovery.answers || {} },
          );
          setResult(completed);
          setPhase("done");
          localStorage.removeItem(recoveryKey);
          return;
        } catch { /* fall through to recovery message */ }
      }
      setMessage(error instanceof Error ? error.message : "Could not restore this exam session.");
      setPhase("loading");
    }
  }, [persistRecovery, queueEvent, recoveryKey, resyncTimer, syncNow]);

  useEffect(() => {
    if (!inst || recoveryAttemptedRef.current) return;
    recoveryAttemptedRef.current = true;
    try {
      const raw = localStorage.getItem(recoveryKey);
      if (!raw) return;
      const recovery = JSON.parse(raw) as RecoveryState;
      if (!recovery.attemptId || !recovery.accessToken || new Date(recovery.accessExpiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(recoveryKey);
        return;
      }
      void loadLiveSession(recovery, true);
    } catch {
      localStorage.removeItem(recoveryKey);
    }
  }, [inst, loadLiveSession, recoveryKey]);

  const startExam = async () => {
    if (!inst || starting || !consented) return;
    setStarting(true);
    setMessage(null);
    try {
      const data = await (
        await apiRequest("POST", `/api/x/${code}/start`, {
          email,
          inviteToken: invitationLink?.token,
          password: inst.requiresPassword ? password : undefined,
          evidenceConsent: true,
        })
      ).json();
      const recovery: RecoveryState = {
        attemptId: data.attemptId,
        accessToken: data.accessToken,
        accessExpiresAt: data.accessExpiresAt,
        startedAt: data.startedAt,
        proctorMode: data.proctorMode,
        answers: {},
        pendingEvents: [],
      };
      await loadLiveSession(recovery, false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the exam.");
    } finally {
      setStarting(false);
    }
  };

  const chooseAnswer = (questionId: number, optionIndex: number) => {
    if (secondsLeft <= 0) return;
    const next = { ...answersRef.current, [questionId]: optionIndex };
    answersRef.current = next;
    setAnswers(next);
    setSyncState(navigator.onLine ? "pending" : "offline");
    persistRecovery();
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => { void syncNow(); }, 700);
  };

  const submitExam = useCallback(async () => {
    const activeAttemptId = attemptIdRef.current;
    const token = accessTokenRef.current;
    if (!activeAttemptId || !token || submittingRef.current) return;
    if (!navigator.onLine) {
      autoSubmitRef.current = true;
      setSyncState("offline");
      setMessage("Time is up. Your saved answers will submit automatically when the connection returns.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      void syncNow();
      const data = await attemptRequest<ExamResult>(
        "POST",
        `/api/exam-attempts/${activeAttemptId}/submit`,
        token,
        { answers: answersRef.current },
      );
      setResult(data);
      setPhase("done");
      autoSubmitRef.current = false;
      try { localStorage.removeItem(recoveryKey); } catch { /* ignore */ }
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch (error) {
      autoSubmitRef.current = Date.now() >= deadlineRef.current;
      setMessage(
        !navigator.onLine
          ? "Submission is waiting for the connection to return. Your answers remain saved on this device."
          : error instanceof Error ? error.message : "Could not submit the exam. Please retry.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [recoveryKey, syncNow]);

  useEffect(() => {
    if (phase !== "live") return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        void submitExam();
      }
    };
    updateTimer();
    const tick = window.setInterval(updateTimer, 1000);
    const heartbeat = window.setInterval(() => { void syncNow(); }, 15_000);
    return () => { window.clearInterval(tick); window.clearInterval(heartbeat); };
  }, [phase, submitExam, syncNow]);

  useEffect(() => {
    if (phase !== "live") return;

    const onOffline = () => {
      if (offlineSinceRef.current === null) offlineSinceRef.current = Date.now();
      queueEvent("network_offline");
      setSyncState("offline");
      persistRecovery();
    };
    const onOnline = () => {
      const durationMs = offlineSinceRef.current === null ? 0 : Math.max(0, Date.now() - offlineSinceRef.current);
      offlineSinceRef.current = null;
      queueEvent("network_online", { durationMs });
      setSyncState("pending");
      void syncNow().then(() => {
        if (autoSubmitRef.current || Date.now() >= deadlineRef.current) void submitExam();
      });
    };
    const onVisibility = () => {
      queueEvent(document.hidden ? "visibility_hidden" : "visibility_visible");
      if (document.hidden) void syncNow(true);
    };
    const onBlur = () => queueEvent("window_blur");
    const onFocus = () => queueEvent("window_focus");
    const onFullscreen = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      queueEvent(active ? "fullscreen_enter" : "fullscreen_exit");
    };
    const onPaste = () => queueEvent("paste");
    const onPageHide = () => { persistRecovery(); void syncNow(true); };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("paste", onPaste);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [phase, persistRecovery, queueEvent, submitExam, syncNow]);

  useEffect(() => () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
  }, []);

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      queueEvent("fullscreen_unavailable", { reason: "browser_or_user_denied" });
      setMessage("Fullscreen was not available. You can continue; the reviewer will see that it was unavailable.");
    }
  };

  const loadReview = async () => {
    const activeAttemptId = attemptIdRef.current;
    const token = accessTokenRef.current;
    if (!activeAttemptId || !token || reviewLoading) return;
    setReviewLoading(true);
    setReviewMessage(null);
    try {
      const payload = await attemptRequest<ExamReview>(
        "GET",
        `/api/exam-attempts/${activeAttemptId}/review`,
        token,
      );
      setReview(payload);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "Answer review is not available yet.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (isLoading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading exam…</div>;
  if (!inst || instanceError) return (
    <div className="min-h-screen grid place-items-center bg-cream-deep px-4">
      <Card className="max-w-md"><CardContent className="p-6 text-center"><XCircle className="w-10 h-10 mx-auto text-slate-400 mb-3" /><h1 className="font-semibold mb-2">Exam unavailable</h1><p className="text-sm text-slate-500">{instanceError instanceof Error ? instanceError.message : "This share link is invalid, closed or expired."}</p></CardContent></Card>
    </div>
  );

  const current = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const opensAt = inst.startsAt ? new Date(inst.startsAt) : null;
  const hasNotOpened = !!opensAt && opensAt.getTime() > Date.now();
  const isBrowserEvidence = (phase === "gate" ? inst.proctorMode : activeProctorMode) === "browser_evidence";

  return (
    <div className="min-h-screen bg-cream-deep px-4 py-8 sm:py-12">
      <SEO title={`${inst.title} — Exam`} description="Octamy scheduled assessment" />
      <Card className="w-full max-w-3xl mx-auto border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{inst.title}</span>
            {phase === "live" && (
              <span className={`text-sm font-mono flex items-center gap-1 px-2.5 py-1 rounded-lg shrink-0 ${secondsLeft <= 60 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                <Clock className="w-4 h-4" />{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {phase === "gate" && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-slate-700">{inst.durationMin} min · {inst.questionCount} questions · Passing {inst.passingScore}% · {inst.maxAttempts} attempt{inst.maxAttempts === 1 ? "" : "s"}</p>
                <p className="text-xs text-slate-500 mt-1">The server timer starts when the access checks succeed; refreshes do not reset it.</p>
                <p className="text-xs text-slate-500 mt-1">
                  {inst.reviewPolicy === "immediate" && "Answer review is available after each submission."}
                  {inst.reviewPolicy === "after_final_attempt" && "Answer review is available after your final permitted attempt."}
                  {inst.reviewPolicy === "after_window" && `Answer review is available after the exam window${inst.reviewAvailableAt ? ` (${new Date(inst.reviewAvailableAt).toLocaleString()})` : " closes"}.`}
                  {inst.reviewPolicy === "score_only" && "This assessment provides a score summary without answer keys."}
                  {inst.retakeCooldownMin > 0 && ` Retakes have a ${inst.retakeCooldownMin}-minute cooldown.`}
                </p>
              </div>
              {hasNotOpened && <Notice>This exam opens {opensAt!.toLocaleString()}.</Notice>}
              {inst.accessMode === "cohort_invite" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                  This is a private, institute-funded assessment. You will not be charged. Your invitation is bound to the cohort email shown below.
                </div>
              ) : inst.cohortRestricted ? (
                <p className="text-xs text-slate-500">Use the email address enrolled in the assigned cohort.</p>
              ) : null}

              <div className={`rounded-xl border p-4 ${isBrowserEvidence ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex gap-3">
                  <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${isBrowserEvidence ? "text-indigo-700" : "text-slate-600"}`} />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">{isBrowserEvidence ? "Browser evidence exam" : "Standard assessment"}</p>
                    <p className="text-slate-600 mt-1 leading-5">{inst.evidenceDisclosure}</p>
                    {isBrowserEvidence && <p className="text-slate-600 mt-2 leading-5">These events provide context to a human reviewer. They are not proof of misconduct and do not change your score automatically.</p>}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-800">Your email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={inst.accessMode === "cohort_invite"}
                  aria-readonly={inst.accessMode === "cohort_invite"}
                  placeholder="you@email.com"
                  className="mt-1"
                />
              </div>
              {inst.requiresPassword && (
                <div>
                  <label className="text-sm font-medium text-slate-800 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Exam password</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
                </div>
              )}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer bg-white">
                <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" />
                <span className="text-sm text-slate-700">I have read the evidence notice and consent to the described collection for this attempt.</span>
              </label>
              <Button onClick={startExam} disabled={!email || !consented || hasNotOpened || starting} className="w-full bg-slate-900 text-white">
                {starting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting securely…</> : "Start exam"}
              </Button>
              {message && <Notice>{message}</Notice>}
            </div>
          )}

          {phase === "loading" && (
            <div className="py-10 text-center space-y-4">
              {!message ? <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-500" /> : <AlertCircle className="w-8 h-8 mx-auto text-amber-600" />}
              <div><p className="font-medium text-slate-900">{message ? "Session needs attention" : "Preparing your saved session"}</p><p className="text-sm text-slate-500 mt-1">{message || "Loading the fixed question set and last autosave…"}</p></div>
              {message && attemptIdRef.current && accessTokenRef.current && (
                <Button variant="outline" onClick={() => loadLiveSession({
                  attemptId: attemptIdRef.current!,
                  accessToken: accessTokenRef.current!,
                  accessExpiresAt: accessExpiresAtRef.current!,
                  startedAt: startedAtRef.current!,
                  proctorMode: proctorModeRef.current,
                  answers: answersRef.current,
                  pendingEvents: eventsRef.current,
                }, true)}>Retry recovery</Button>
              )}
            </div>
          )}

          {phase === "live" && current && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>Question {currentIdx + 1} of {questions.length} · {answeredCount} answered</span>
                <div className="flex items-center gap-2">
                  <SyncStatus state={syncState} lastSavedAt={lastSavedAt} />
                  {isBrowserEvidence && !isFullscreen && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={enterFullscreen}><Maximize className="w-3 h-3 mr-1" /> Fullscreen</Button>}
                </div>
              </div>
              {syncState === "offline" && <Notice><WifiOff className="w-4 h-4 inline mr-1" /> You are offline. Answers remain on this device and will sync automatically when the connection returns. The timer continues.</Notice>}
              {excludedQuestionCount > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  {excludedQuestionCount} question-bank item{excludedQuestionCount === 1 ? "" : "s"} use formats this runner does not auto-grade and are not part of this scored attempt. Only the {questions.length} displayed single-choice/true-false questions count.
                </div>
              )}
              {message && <Notice>{message}</Notice>}
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-900 transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} /></div>

              <div>
                <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-4 whitespace-pre-wrap">{current.question}</h3>
                {current.imageUrl && <img src={current.imageUrl} alt="Question reference" className="mb-4 rounded-lg max-h-64 border border-slate-200" />}
                <div className="space-y-2">
                  {current.options.map((option, index) => {
                    const selected = answers[current.id] === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={secondsLeft <= 0}
                        onClick={() => chooseAnswer(current.id, index)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition disabled:opacity-60 ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-400"}`}
                      >
                        <span className="font-mono text-xs mr-3 opacity-70">{String.fromCharCode(65 + index)}</span>{option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setCurrentIdx((index) => Math.max(0, index - 1))} disabled={currentIdx === 0}><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
                {currentIdx < questions.length - 1 ? (
                  <Button onClick={() => setCurrentIdx((index) => Math.min(questions.length - 1, index + 1))}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                ) : (
                  <Button onClick={() => void submitExam()} disabled={submitting} className="bg-slate-900 text-white">
                    {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting…</> : secondsLeft <= 0 ? "Retry submission" : "Submit exam"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {phase === "done" && result && (
            <div className="space-y-6 py-8">
              <div className="text-center space-y-4">
              {result.passed ? <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" /> : <XCircle className="w-14 h-14 mx-auto text-slate-400" />}
              <h2 className="text-2xl font-bold text-slate-900">{result.passed ? "Passed" : result.timedOut ? "Time expired" : "Not passed"}</h2>
              <p className="text-slate-600">Score: <span className="font-semibold">{result.scorePct}%</span> ({result.score} / {result.totalPoints} points)</p>
              <p className="text-xs text-slate-500">{result.totalQuestions} questions · Passing mark was {inst.passingScore}%. Your exam owner can review the separate technical and browser evidence record.</p>
              {inst.reviewPolicy !== "score_only" && !review && (
                <Button variant="outline" onClick={() => void loadReview()} disabled={reviewLoading}>
                  {reviewLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking review access…</> : "Review answers"}
                </Button>
              )}
              {inst.reviewPolicy === "score_only" && <p className="text-sm text-slate-500">Answer keys are not released for this assessment.</p>}
              {reviewMessage && <Notice>{reviewMessage}</Notice>}
              </div>
              {review && (
                <div className="space-y-3 text-left">
                  <h3 className="text-base font-semibold text-slate-900">Answer review</h3>
                  {review.questions.map((question, index) => {
                    const submittedIndex = typeof question.submittedAnswer === "number" ? question.submittedAnswer : null;
                    return (
                      <div key={question.id} className={`rounded-xl border p-4 ${question.isCorrect ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-start gap-2">
                          {question.isCorrect ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{index + 1}. {question.question}</p>
                            <p className="mt-2 text-xs text-slate-600">Your answer: {submittedIndex === null ? "Not answered" : question.options[submittedIndex] ?? "Invalid option"}</p>
                            {!question.isCorrect && <p className="mt-1 text-xs font-medium text-emerald-700">Correct answer: {question.correctOption ?? "Unavailable"}</p>}
                            {question.explanation && <p className="mt-2 text-xs leading-5 text-slate-600">{question.explanation}</p>}
                            <p className="mt-2 text-xs text-slate-500">{question.awardedPoints} / {question.maxPoints} points</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">{children}</div>;
}

function SyncStatus({ state, lastSavedAt }: { state: "saved" | "saving" | "pending" | "offline"; lastSavedAt: string | null }) {
  if (state === "offline") return <span className="inline-flex items-center gap-1 text-amber-700"><WifiOff className="w-3.5 h-3.5" /> Offline · saved locally</span>;
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-slate-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>;
  if (state === "pending") return <span className="inline-flex items-center gap-1 text-amber-700"><Save className="w-3.5 h-3.5" /> Save pending</span>;
  return <span className="inline-flex items-center gap-1 text-emerald-700" title={lastSavedAt ? new Date(lastSavedAt).toLocaleString() : undefined}><Wifi className="w-3.5 h-3.5" /> Saved</span>;
}
