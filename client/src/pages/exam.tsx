import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ApiError, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth.tsx';
import Header from '@/components/header';
import ExamTimer from '@/components/exam-timer';
import { ExamStructuredData } from '@/components/seo-structured-data';
import { SEO } from '@/components/seo';
import { FullscreenExitGuard, QuestionNavigator, SubmitExamDialog } from '@/components/exam-session-controls';
import { publicAssessmentCategoryPath, publicAssessmentPath, publicPracticeCategoryPath, publicPracticePath } from '@shared/public-assessment-routes';
import { practicePlansPath, practicePricingPath } from '@/lib/practice-purchase-intent';
import { shouldEnforceExamFullscreen, supportsBrowserFullscreen } from '@/lib/exam-display-mode';
import {
  examAccountGatePresentation,
  isExamAccountRequiredError,
  type ExamAccountGatePresentation,
  type ExamAccountGateReason,
} from '@/lib/exam-account-intent';
import { AlertTriangle, Award, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileQuestion, Flag, LockKeyhole, LogIn, RotateCcw, Save, Send, ShieldCheck, TicketCheck, UserPlus, WifiOff } from 'lucide-react';

interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
}

type ExamQuestionsPayload = {
  questions: ExamQuestion[];
  sessionId: string;
  startedAt: string;
  deadlineAt: string;
};

type SavedExamDraft = {
  version: 2;
  courseId: number;
  slug: string;
  questions: ExamQuestion[];
  sessionId: string;
  answers: Record<string, number>;
  flaggedQuestionIds?: number[];
  currentQuestion: number;
  examStartTime: number;
  deadlineAt: number;
  tabSwitches: number;
  userInfo: { name: string; email: string };
  expiresAt: number;
};

function ExamAccountGate({
  presentation,
  compact = false,
  onContinueAsGuest,
}: {
  presentation: ExamAccountGatePresentation;
  compact?: boolean;
  onContinueAsGuest?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [presentation.title]);

  return (
    <section
      role="alert"
      aria-live="assertive"
      aria-labelledby="exam-account-gate-title"
      aria-describedby="exam-account-gate-description"
      className={`rounded-xl border border-slate-300 bg-white ${compact ? "p-4" : "p-6"}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black text-white" aria-hidden="true"><LockKeyhole className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">{presentation.eyebrow}</p>
          <h2 id="exam-account-gate-title" ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-black text-slate-950 outline-none">{presentation.title}</h2>
          <p id="exam-account-gate-description" className="mt-2 text-sm leading-6 text-slate-700">{presentation.description}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button asChild className="min-h-11 rounded-lg bg-black text-white hover:bg-slate-800"><Link href={presentation.createAccountHref}><UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />Register</Link></Button>
        <Button asChild variant="outline" className="min-h-11 rounded-lg border-slate-400 bg-white text-black hover:bg-slate-100"><Link href={presentation.loginHref}><LogIn className="mr-2 h-4 w-4" aria-hidden="true" />Login</Link></Button>
      </div>
      {onContinueAsGuest && (
        <Button type="button" variant="ghost" className="mt-2 min-h-11 w-full rounded-lg text-black hover:bg-slate-100" onClick={onContinueAsGuest}>
          Continue as guest
        </Button>
      )}
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {onContinueAsGuest
          ? "Continue as guest to review the exam details. Registration or login is required only when you start and submit this exam."
          : "Exam results and optional credentials must belong to a learner account."}
      </p>
    </section>
  );
}

type PublicAssessment = {
  id: number;
  title: string;
  description: string;
  slug: string;
  categoryId: number;
  duration: number;
  passingScore: number;
  price: string;
  originalPrice: string | null;
  isOnSale: boolean;
  subscriptionEligible: boolean;
  productType: "assessment";
  level: string;
  language: string;
  thumbnailUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  origin: "octamy" | "creator";
  originLabel: string;
  certificationLabel: string;
  assessmentPurpose: "certification" | "practice";
  canonicalPath: string;
  category: { id: number; name: string; slug: string; kind: string };
  creator: { displayName: string; slug: string } | null;
};

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export default function Exam() {
  const { slug } = useParams();
  const [location, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [examStarted, setExamStarted] = useState(false);
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [restoredQuestionsData, setRestoredQuestionsData] = useState<ExamQuestionsPayload | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedExamDraft | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenEnforced, setFullscreenEnforced] = useState(() => shouldEnforceExamFullscreen());
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<number>>(() => new Set());
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [returningToFullscreen, setReturningToFullscreen] = useState(false);
  const [integrityConsent, setIntegrityConsent] = useState(false);
  const [accountGateReason, setAccountGateReason] = useState<ExamAccountGateReason | null>(null);
  const [guestBrowsing, setGuestBrowsing] = useState(false);
  const examEndingRef = useRef(false);
  const submissionRequestedRef = useRef(false);
  const autoSubmitFiredRef = useRef(false);
  const [userInfo, setUserInfo] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  useEffect(() => {
    if (!user || examStarted) return;
    setUserInfo({ name: user.name || '', email: user.email || '' });
  }, [examStarted, user]);

  const practicePage = location === "/practice" || location.startsWith("/practice/");
  const detailEndpoint = practicePage ? "/api/practice-assessments" : "/api/assessments";
  const { data: course, isLoading: courseLoading, error: courseError } = useQuery<PublicAssessment>({
    queryKey: [detailEndpoint, slug],
    enabled: !!slug,
    retry: false,
    queryFn: async () => (await apiRequest("GET", `${detailEndpoint}/${encodeURIComponent(String(slug || ""))}`)).json(),
  });
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<{
    learner: { plan: string; renewsAt: string | null; status: string } | null;
  }>({
    queryKey: ['/api/me/subscription'],
    enabled: course?.assessmentPurpose === 'practice' && !!user,
    retry: false,
  });
  const hasPracticeAccess = subscriptionData?.learner?.plan === 'all_access'
    && subscriptionData.learner.status === 'active'
    && !!subscriptionData.learner.renewsAt
    && Date.parse(subscriptionData.learner.renewsAt) > Date.now();

  // Preserve old indexed links while keeping preparation content out of the
  // recruiter-facing certification namespace.
  useEffect(() => {
    if (practicePage || !slug || !/(?:practice|diagnostic)$/i.test(slug)) return;
    setLocation(publicPracticePath(slug), { replace: true });
  }, [practicePage, setLocation, slug]);

  useEffect(() => {
    if (!course?.canonicalPath || typeof window === "undefined") return;
    if (window.location.pathname !== course.canonicalPath) {
      setLocation(`${course.canonicalPath}${window.location.search}`, { replace: true });
    }
  }, [course?.canonicalPath, setLocation]);

  const {
    data: questionsData,
    error: questionsError,
    isLoading: questionsLoading,
    refetch: refetchQuestions,
  } = useQuery<ExamQuestionsPayload>({
    queryKey: [`/api/courses/${course?.id}/questions`, examStarted],
    queryFn: async () => {
      // The server creates and owns the authoritative attempt session ID.
      const response = await apiRequest('POST', `/api/courses/${course?.id}/questions`, {
        evidenceConsent: course?.assessmentPurpose !== 'practice',
      }, { redirectOnUnauthorized: false });
      return response.json();
    },
    enabled: !!course?.id && examStarted && !restoredQuestionsData,
    retry: (failureCount, error) => !isExamAccountRequiredError(error) && failureCount < 2,
  });

  const activeQuestionsData = restoredQuestionsData || questionsData;
  const questions = activeQuestionsData?.questions || [];

  // Set session ID when questions data is available
  useEffect(() => {
    if (activeQuestionsData?.sessionId) {
      setSessionId(activeQuestionsData.sessionId);
    }
    const authoritativeStart = Date.parse(activeQuestionsData?.startedAt || "");
    if (Number.isFinite(authoritativeStart)) setExamStartTime(authoritativeStart);
  }, [activeQuestionsData]);

  useEffect(() => {
    if (!course?.id || typeof window === 'undefined' || examStarted) return;
    const key = `octamy.examDraft.${course.id}`;
    try {
      const draft = JSON.parse(localStorage.getItem(key) || 'null') as SavedExamDraft | null;
      if (
        draft?.version === 2
        && draft.courseId === course.id
        && draft.slug === course.slug
        && draft.expiresAt > Date.now()
        && Array.isArray(draft.questions)
        && draft.questions.length > 0
        && typeof draft.sessionId === 'string'
        && Number.isFinite(draft.examStartTime)
        && Number.isFinite(draft.deadlineAt)
      ) {
        setSavedDraft(draft);
      } else if (draft) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }, [course?.id, course?.slug, examStarted]);

  useEffect(() => {
    if (!course?.id || !examStarted || !sessionId || !activeQuestionsData || questions.length === 0 || typeof window === 'undefined') return;
    const draft: SavedExamDraft = {
      version: 2,
      courseId: course.id,
      slug: course.slug,
      questions,
      sessionId,
      answers,
      flaggedQuestionIds: Array.from(flaggedQuestionIds),
      currentQuestion,
      examStartTime,
      deadlineAt: Date.parse(activeQuestionsData.deadlineAt),
      tabSwitches,
      userInfo,
      expiresAt: Date.parse(activeQuestionsData.deadlineAt) + 15_000,
    };
    localStorage.setItem(`octamy.examDraft.${course.id}`, JSON.stringify(draft));
  }, [activeQuestionsData, answers, course?.id, course?.slug, currentQuestion, examStartTime, examStarted, flaggedQuestionIds, questions, sessionId, tabSwitches, userInfo]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // Certification-only browser integrity evidence. Practice is deliberately
  // non-proctored and must not block ordinary browser or accessibility actions.
  useEffect(() => {
    if (!examStarted || course?.assessmentPurpose === "practice") return;

    const handleVisibilityChange = () => {
      if (document.hidden && isWindowFocused) {
        setTabSwitches(prev => prev + 1);
        setIsWindowFocused(false);
        toast({
          title: "Assessment integrity notice",
          description: "A tab change was recorded. Stay in this assessment window to keep the attempt valid.",
        });
      } else if (!document.hidden && !isWindowFocused) {
        setIsWindowFocused(true);
      }
    };

    const handleBlur = () => {
      if (isWindowFocused) {
        setTabSwitches(prev => prev + 1);
        setIsWindowFocused(false);
      }
    };

    const handleFocus = () => {
      setIsWindowFocused(true);
    };

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Prevent common keyboard shortcuts for cheating
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+U, Ctrl+Shift+J
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        toast({
          title: "Action Blocked",
          description: "Developer tools and view source are disabled during the exam.",
          variant: "destructive",
        });
      }
    };

    const handlePasteOrCopy = (event: ClipboardEvent) => {
      event.preventDefault();
      setTabSwitches((previous) => previous + 1);
      toast({ title: "Assessment integrity notice", description: "Copy and paste activity is disabled and was recorded for this attempt." });
    };

    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreenActive(active);
      if (fullscreenEnforced && !active && !examEndingRef.current) {
        setSubmitDialogOpen(false);
        setTabSwitches((previous) => previous + 1);
        toast({ title: "Fullscreen exited", description: "The exit was recorded. Return to fullscreen before continuing." });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePasteOrCopy);
    document.addEventListener('copy', handlePasteOrCopy);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    setFullscreenActive(Boolean(document.fullscreenElement));

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePasteOrCopy);
      document.removeEventListener('copy', handlePasteOrCopy);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [course?.assessmentPurpose, examStarted, fullscreenEnforced, isWindowFocused, toast]);

  const submitExamMutation = useMutation({
    mutationFn: async (examData: any) => {
      return apiRequest('POST', '/api/exam/submit', examData, { redirectOnUnauthorized: false });
    },
    onSuccess: async (response) => {
      const result = await response.json();
      examEndingRef.current = true;
      
      // Always redirect to temporary exam results page (payment-first approach)
      // User will see results and then be prompted to pay regardless of pass/fail
      if (result.tempExamId) {
        if (course?.id) localStorage.removeItem(`octamy.examDraft.${course.id}`);
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
        setLocation(`/exam-results-temp/${result.tempExamId}`);
      } else {
        // Fallback for any edge cases
        toast({
          title: result.passed ? "Exam Completed" : "Exam Failed",
          description: result.message || `You scored ${result.score}%.`,
          variant: result.passed ? "default" : "destructive",
        });
      }
    },
    onError: (error: unknown) => {
      submissionRequestedRef.current = false;
      examEndingRef.current = false;
      if (isExamAccountRequiredError(error)) {
        setAccountGateReason(error instanceof ApiError && error.code === 'TOKEN_EXPIRED' ? 'session-expired' : 'account-required');
        setSubmitDialogOpen(false);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        return;
      }
      if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') {
        toast({
          title: "Session Expired",
          description: "Your exam session has expired. Please start the exam again.",
          variant: "destructive",
        });
        window.location.reload();
        return;
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit exam. Please try again.",
        variant: "destructive",
      });
    },
  });

  const enterFullscreen = async () => {
    if (!fullscreenEnforced) return true;
    if (document.fullscreenElement) return true;
    if (!supportsBrowserFullscreen()) {
      setFullscreenEnforced(false);
      toast({ title: "Mobile exam mode", description: "This browser does not support page fullscreen. The exam will use the full mobile viewport while other integrity signals remain active." });
      return true;
    }
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenActive(true);
      return true;
    } catch {
      toast({ title: "Fullscreen permission needed", description: "Allow fullscreen for the strongest proctored assessment experience." });
      return false;
    }
  };

  const returnToFullscreen = async () => {
    setReturningToFullscreen(true);
    try {
      await enterFullscreen();
    } finally {
      setReturningToFullscreen(false);
    }
  };

  const startExam = async () => {
    if (course?.assessmentPurpose !== "practice" && !user) {
      setAccountGateReason('before-start');
      return;
    }
    if (course?.assessmentPurpose === "practice" && !user) {
      setLocation(practicePlansPath({ next: location }));
      return;
    }
    if (course?.assessmentPurpose === "practice" && !hasPracticeAccess) {
      setLocation(practicePricingPath({ next: location }));
      return;
    }
    if (!userInfo.name || !userInfo.email) {
      toast({
        title: "Required Information",
        description: "Please provide your name and email to start the exam.",
        variant: "destructive",
      });
      return;
    }
    if (course?.assessmentPurpose !== "practice" && !integrityConsent) {
      toast({ title: "Consent required", description: "Review and accept the browser integrity evidence notice before starting." });
      return;
    }
    if (course?.assessmentPurpose !== "practice" && !(await enterFullscreen())) return;
    
    // Reset state for fresh exam attempt
    setSessionId('');
    setRestoredQuestionsData(null);
    setSavedDraft(null);
    if (course?.id) localStorage.removeItem(`octamy.examDraft.${course.id}`);
    setAnswers({});
    setFlaggedQuestionIds(new Set());
    setCurrentQuestion(0);
    setTabSwitches(0);
    setIsWindowFocused(true);
    examEndingRef.current = false;
    submissionRequestedRef.current = false;
    autoSubmitFiredRef.current = false;
    
    // Invalidate queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: [`/api/courses/${course?.id}/questions`] });
    
    setExamStarted(true);
    setExamStartTime(Date.now());
  };

  const resumeSavedExam = async () => {
    if (!savedDraft || savedDraft.expiresAt <= Date.now()) return;
    if (!user) {
      setAccountGateReason('before-start');
      return;
    }
    if (course?.assessmentPurpose === 'practice' && !hasPracticeAccess) {
      setLocation(practicePricingPath({ next: location }));
      return;
    }
    if (course?.assessmentPurpose !== "practice" && !integrityConsent) {
      toast({ title: "Consent required", description: "Review and accept the browser integrity evidence notice before resuming." });
      return;
    }
    if (course?.assessmentPurpose !== "practice" && !(await enterFullscreen())) return;
    setRestoredQuestionsData({
      questions: savedDraft.questions,
      sessionId: savedDraft.sessionId,
      startedAt: new Date(savedDraft.examStartTime).toISOString(),
      deadlineAt: new Date(savedDraft.deadlineAt).toISOString(),
    });
    setSessionId(savedDraft.sessionId);
    setAnswers(savedDraft.answers || {});
    setFlaggedQuestionIds(new Set(savedDraft.flaggedQuestionIds || []));
    setCurrentQuestion(Math.min(savedDraft.currentQuestion || 0, savedDraft.questions.length - 1));
    setTabSwitches(savedDraft.tabSwitches || 0);
    setUserInfo(savedDraft.userInfo);
    setExamStartTime(savedDraft.examStartTime);
    examEndingRef.current = false;
    submissionRequestedRef.current = false;
    autoSubmitFiredRef.current = false;
    setExamStarted(true);
  };

  const discardSavedExam = () => {
    if (course?.id) localStorage.removeItem(`octamy.examDraft.${course.id}`);
    setSavedDraft(null);
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: parseInt(answer)
    }));
  };

  const toggleFlaggedQuestion = (questionId: number) => {
    setFlaggedQuestionIds((previous) => {
      const next = new Set(previous);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmit = () => {
    if (submissionRequestedRef.current || submitExamMutation.isPending) return;
    submissionRequestedRef.current = true;
    setSubmitDialogOpen(false);
    const timeTaken = Math.floor((Date.now() - examStartTime) / 1000);
    
    // Certification-only browser integrity review.
    if (course?.assessmentPurpose !== "practice" && tabSwitches > 5) {
      toast({
        title: "Attempt flagged for review",
        description: "Multiple tab changes were recorded and will be included in the assessment evidence.",
      });
    }
    
    submitExamMutation.mutate({
      courseId: course?.id!,
      answers,
      timeTaken,
      userName: userInfo.name,
      userEmail: userInfo.email,
      sessionId,
      tabSwitches: course?.assessmentPurpose === "practice" ? 0 : tabSwitches,
    });
  };

  const handleTimeUp = () => {
    if (autoSubmitFiredRef.current || submissionRequestedRef.current) return;
    autoSubmitFiredRef.current = true;
    toast({
      title: "Time's Up!",
      description: "Your exam has been auto-submitted.",
    });
    handleSubmit();
  };

  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  if (courseLoading) {
    return <div className="min-h-screen bg-slate-50"><SEO title="Loading assessment" path={practicePage ? publicPracticePath(slug) : publicAssessmentPath(slug)} noIndex /><Header /><main className="mx-auto max-w-5xl px-5 py-16"><div className="h-96 animate-pulse rounded-3xl bg-slate-200" /></main></div>;
  }

  if (!course || courseError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SEO title={practicePage ? "Practice exam not found" : "Certification not found"} description={practicePage ? "This practice exam is unavailable or is no longer public." : "This certification exam is unavailable or is no longer public."} path={practicePage ? publicPracticePath(slug) : publicAssessmentPath(slug)} noIndex />
        <Header />
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="text-3xl font-black text-slate-950">{practicePage ? "Practice exam unavailable" : "Certification unavailable"}</h1>
          <p className="mt-3 leading-7 text-slate-600">The link may be incorrect, or this exam is no longer published.</p>
          <Button asChild variant="outline" className="mt-6"><Link href={practicePage ? "/practice" : "/get-certified"}>{practicePage ? "Browse practice" : "Browse certifications"}</Link></Button>
        </main>
      </div>
    );
  }

  const isPractice = course.assessmentPurpose === "practice";
  const canonicalPath = course.canonicalPath || (isPractice ? publicPracticePath(course.slug) : publicAssessmentPath(course.slug));
  const displayTitle = course.title;
  const seoTitle = isPractice ? (course.metaTitle || `${displayTitle} | Octamy Practice`) : (course.metaTitle || `${displayTitle} | Octamy`)
    .replace(/\bPractice\s*\|\s*Octamy Assessments?\b/gi, "Certification Exam | Octamy")
    .replace(/\bAssessments\b/gi, "Certification Exams")
    .replace(/\bAssessment\b/gi, "Certification Exam");
  const gatePresentation = examAccountGatePresentation({
    authenticated: Boolean(user) || authLoading,
    assessmentPath: canonicalPath,
    reason: accountGateReason || (!authLoading && !user && savedDraft ? 'account-required' : null),
  });
  const refusalPresentation = isExamAccountRequiredError(questionsError)
    ? examAccountGatePresentation({ authenticated: false, assessmentPath: canonicalPath, reason: 'account-required' })
    : null;
  const metaDescription = course.metaDescription || (isPractice
    ? `Practice ${displayTitle} with rotating questions and answer review. Practice Pass is required to start.`
    : `Take the ${displayTitle} exam free. Review the published passing threshold before you begin; credential activation is optional after a passing result.`);
  const credentialPrice = Number(course.price);
  const originalCredentialPrice = Number(course.originalPrice);
  const credentialIsOnSale = Number.isFinite(credentialPrice)
    && Number.isFinite(originalCredentialPrice)
    && originalCredentialPrice > credentialPrice;
  const credentialSavings = credentialIsOnSale ? originalCredentialPrice - credentialPrice : 0;

  if (accountGateReason && examStarted && gatePresentation) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SEO title={`Account required | ${course.title}`} description={metaDescription} path={canonicalPath} noIndex />
        <Header />
        <main id="main-content" className="mx-auto max-w-xl px-4 py-16 sm:px-6">
          <ExamAccountGate presentation={gatePresentation} />
          <p className="mt-4 text-center text-sm text-slate-600">Your saved answers remain on this device while you authenticate.</p>
        </main>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-white">
        <SEO title={seoTitle} description={metaDescription} path={canonicalPath} image={course.thumbnailUrl || undefined} />
        
        <ExamStructuredData course={course} />
        
        <Header />
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
          <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <Link href={isPractice ? "/practice" : course.origin === "creator" ? "/creator-assessments" : "/get-certified"} className="hover:text-slate-950">{isPractice ? "Practice" : course.origin === "creator" ? "Creator certifications" : "Get certified"}</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><Link href={isPractice ? publicPracticeCategoryPath(course.category.slug) : course.origin === "creator" ? `/creator-assessments?category=${encodeURIComponent(course.category.slug)}` : publicAssessmentCategoryPath(course.category.slug)} className="hover:text-slate-950">{course.category.name}</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="max-w-xs truncate font-medium text-slate-800" aria-current="page">{displayTitle}</span>
          </nav>

          <div id="exam-overview" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
            <section className="overflow-hidden rounded-2xl border border-black bg-black text-white">
              <div className="px-6 py-8 sm:px-9 sm:py-10">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.11em]"><Award className="h-3.5 w-3.5" />{isPractice ? "Practice exam" : "Certification exam"}</span>
                  <span className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium text-slate-300">{course.category.name}</span>
                </div>
                <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl">{displayTitle}</h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{course.description}</p>
                <p className="mt-5 flex items-start gap-2 border-t border-white/20 pt-5 text-sm leading-6 text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white" />{isPractice ? "Practice only. No recruiter credential is issued from this attempt." : course.certificationLabel}</p>
              </div>

              <div className="grid border-t border-white/20 sm:grid-cols-3">
                <div className="flex items-center gap-3 border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><Clock3 className="h-5 w-5 text-white" /><div><p className="text-xs uppercase tracking-wider text-slate-400">Duration</p><p className="mt-1 font-bold">{course.duration} minutes</p></div></div>
                <div className="flex items-center gap-3 border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><FileQuestion className="h-5 w-5 text-white" /><div><p className="text-xs uppercase tracking-wider text-slate-400">Format</p><p className="mt-1 font-bold">Timed MCQ</p></div></div>
                <div className="flex items-center gap-3 p-5"><ShieldCheck className="h-5 w-5 text-white" /><div><p className="text-xs uppercase tracking-wider text-slate-400">Pass mark</p><p className="mt-1 font-bold">{course.passingScore}% or higher</p></div></div>
              </div>
            </section>

            <aside className="lg:sticky lg:top-28">
              <Card className="overflow-hidden rounded-2xl border-slate-300 shadow-none">
                <div className="border-b border-slate-200 bg-slate-50 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">Exam access</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{isPractice ? "Included in Practice Pass" : "Free exam attempt"}</p>
                  {isPractice ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">Choose 30-day or 365-day access before login or registration.</p>
                  ) : (
                    <div className="mt-3 border-t border-slate-300 pt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Credential after passing</p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-2xl font-black text-black">{Number.isFinite(credentialPrice) ? formatInr(credentialPrice) : course.price}</span>
                        {credentialIsOnSale && <span className="text-sm text-slate-500 line-through">{formatInr(originalCredentialPrice)}</span>}
                        {credentialIsOnSale && <span className="rounded-full border border-black px-2 py-0.5 text-xs font-bold text-black">Save {formatInr(credentialSavings)}</span>}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Payment is optional and requested only after a passing result.</p>
                    </div>
                  )}
                </div>
                <CardContent className="space-y-5 p-6">
                  {!user && !isPractice && gatePresentation && !guestBrowsing && (
                    <ExamAccountGate presentation={gatePresentation} compact onContinueAsGuest={() => setGuestBrowsing(true)} />
                  )}

                  {!user && !isPractice && guestBrowsing && (
                    <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-600">Browsing as guest</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">You can review this exam, its price, and requirements without an account. Register or login when you are ready to start.</p>
                      <Button type="button" variant="outline" className="mt-3 w-full rounded-lg border-slate-400 bg-white text-black hover:bg-slate-100" onClick={() => setGuestBrowsing(false)}>Show exam access options</Button>
                    </div>
                  )}

                  {user && <div className="rounded-xl border border-slate-300 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-600">Signed-in learner</p><p className="mt-1 font-bold text-slate-950">{user.name}</p><p className="text-sm text-slate-600">{user.email}</p><p className="mt-2 text-xs text-slate-600">Your account identity will be used automatically for this attempt.</p></div>}

                  {user && isPractice && !subscriptionLoading && !hasPracticeAccess && <div className="rounded-xl border border-slate-300 bg-white p-4"><p className="font-black text-slate-950">Practice Pass required</p><p className="mt-1 text-sm leading-6 text-slate-600">Review 30-day or 365-day access. Your account details are already attached, so they will not be requested again.</p><Button type="button" className="mt-4 w-full rounded-lg bg-black text-white hover:bg-slate-800" onClick={() => setLocation(practicePricingPath({ next: location }))}>Review Practice Pass</Button></div>}

                  {!user && isPractice && <div className="rounded-xl border border-slate-300 bg-white p-4"><p className="font-black text-slate-950">Choose a Practice Pass first</p><p className="mt-1 text-sm leading-6 text-slate-600">Select a plan first. Login or registration follows your selection; guest attempts are not included with Practice Pass.</p><Button type="button" className="mt-4 w-full rounded-lg bg-black text-white hover:bg-slate-800" onClick={() => setLocation(practicePlansPath({ next: location }))}>View Practice Pass plans</Button></div>}

                  {user && !isPractice && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
                    <input type="checkbox" checked={integrityConsent} onChange={(event) => setIntegrityConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-400 accent-black" />
                    <span className="text-xs leading-5 text-slate-600"><strong className="block text-sm text-slate-900">Browser integrity evidence consent</strong>I understand that fullscreen changes, tab/window focus changes, and the occurrence of copy or paste attempts are recorded for assessment integrity. Octamy does not capture screen contents, webcam, microphone, audio, or keystrokes in this exam.</span>
                  </label>}

                  {user && savedDraft && <div className="rounded-xl border border-slate-300 bg-slate-50 p-4"><div className="flex items-start gap-3"><RotateCcw className="mt-0.5 h-5 w-5 text-black" /><div className="min-w-0 flex-1"><h2 className="font-bold text-slate-950">Saved attempt found</h2><p className="mt-1 text-sm leading-5 text-slate-600">{Object.keys(savedDraft.answers).length} of {savedDraft.questions.length} answers saved on this device.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" className="bg-black text-white hover:bg-slate-800" onClick={resumeSavedExam} disabled={!isPractice && !integrityConsent}>Resume exam</Button><Button size="sm" variant="ghost" onClick={discardSavedExam}>Discard</Button></div></div></div></div>}

                  {!savedDraft && user && (!isPractice || hasPracticeAccess) && <Button onClick={startExam} className="h-12 w-full rounded-lg bg-black text-base font-black text-white hover:bg-slate-800" disabled={!userInfo.name || !userInfo.email || (!isPractice && !integrityConsent)}>{isPractice ? "Start practice exam" : "Start free certification exam"}</Button>}
                  <ul className="space-y-2.5 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-600"><li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black" />Answers autosave on this device during interruptions.</li><li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black" />Your score and answer review appear after submission.</li><li className="flex gap-2"><TicketCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black" />{isPractice ? "Practice attempts are not shared as recruiter credentials." : "Direct payment, coupon, or institute voucher can fund activation."}</li></ul>
                </CardContent>
              </Card>
            </aside>
          </div>

          <section className="mt-6 grid gap-3 rounded-2xl border border-slate-300 bg-white p-5 sm:grid-cols-3 sm:p-6" aria-labelledby="certification-process-title">
            <div className="sm:col-span-3"><h2 id="certification-process-title" className="text-xl font-black">{isPractice ? "How this practice exam works" : "How this certification works"}</h2><p className="mt-1 text-sm text-slate-600">{isPractice ? "A private timed rehearsal with answer review and no credential issuance." : "A transparent result first. Credential activation is your choice after passing."}</p></div>
            {[{ step: "01", title: "Take the exam", copy: "Stay in this tab and complete the timed questions." }, { step: "02", title: "Review your result", copy: "See the score and the published answer review." }, { step: "03", title: isPractice ? "Repeat and improve" : "Activate the credential", copy: isPractice ? "Practice stays separate from recruiter credentials." : "Pay directly, use a coupon, or redeem an institute voucher." }].map((item) => <div key={item.step} className="rounded-xl border border-slate-200 bg-slate-50 p-5"><span className="text-xs font-black text-black">{item.step}</span><h3 className="mt-2 font-black text-slate-950">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{item.copy}</p></div>)}
          </section>
        </main>
      </div>
    );
  }

  if (refusalPresentation) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SEO title={`Account required | ${course.title}`} description={metaDescription} path={canonicalPath} noIndex />
        <Header />
        <main id="main-content" className="mx-auto max-w-xl px-4 py-16 sm:px-6">
          <ExamAccountGate presentation={refusalPresentation} />
          <p className="mt-4 text-center text-sm text-slate-600">Return after authentication to start this exact assessment.</p>
        </main>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div className="min-h-screen bg-white">
        <SEO title={`${course.title} assessment unavailable`} description={metaDescription} path={canonicalPath} noIndex />
        <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <Card className="rounded-xl border-slate-300 shadow-none">
            <CardContent className="py-12">
              <AlertTriangle className="mx-auto h-9 w-9 text-black" />
              <h1 className="mt-4 text-2xl font-black text-slate-950">Assessment session could not start</h1>
              <p className="mt-3 leading-7 text-slate-600">{questionsError instanceof Error ? questionsError.message : "The reviewed question pool is temporarily unavailable."}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={() => refetchQuestions()}>Try again</Button>
                <Button variant="outline" onClick={() => setExamStarted(false)}>Back to assessment</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-white">
        <SEO title={`${course.title} assessment session`} description={metaDescription} path={canonicalPath} noIndex />
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <Card className="rounded-xl border-slate-300 shadow-none"><CardContent className="py-12 text-center" role="status"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-black" aria-hidden="true" /><p className="mt-4">Preparing the reviewed question set…</p></CardContent></Card>
        </main>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <SEO title={`${course.title} assessment unavailable`} description={metaDescription} path={canonicalPath} noIndex />
        <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <Card className="rounded-xl border-slate-300 shadow-none"><CardContent className="py-12"><AlertTriangle className="mx-auto h-9 w-9 text-black" aria-hidden="true" /><h1 className="mt-4 text-2xl font-black text-slate-950">No release-ready questions are available</h1><p className="mt-3 leading-7 text-slate-600">This assessment cannot start until its governed question pool meets publication requirements. No placeholder questions will be used.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button type="button" onClick={() => void refetchQuestions()}>Check again</Button><Button type="button" variant="outline" onClick={() => setExamStarted(false)}>Back to assessment</Button></div></CardContent></Card>
        </main>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const currentQuestionIsFlagged = flaggedQuestionIds.has(currentQ.id);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-white">
      <SEO title={`${course.title} assessment session`} description={metaDescription} path={canonicalPath} noIndex />
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-white shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white">{isPractice ? "Private timed practice" : "Proctored assessment"}</p>
            <p className="mt-0.5 text-sm text-slate-300">{isPractice ? "No fullscreen, clipboard, or focus monitoring. This attempt does not issue recruiter evidence." : fullscreenEnforced ? "Navigation, focus, fullscreen exits, and clipboard actions are monitored." : "Mobile exam mode is active. Navigation, focus, and clipboard actions are still monitored."}</p>
          </div>
          {!isPractice && !fullscreenEnforced
            ? <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-bold text-white"><ShieldCheck className="h-4 w-4" />Mobile exam mode</span>
            : !isPractice && (fullscreenActive
            ? <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-bold text-white"><ShieldCheck className="h-4 w-4" />Fullscreen active</span>
            : <Button type="button" size="sm" variant="secondary" onClick={() => void enterFullscreen()}>Return to fullscreen</Button>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-white">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl sm:text-2xl">{course?.title}</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">Question {currentQuestion + 1} of {questions.length}</p>
                </div>
                <ExamTimer duration={course?.duration || 15} onTimeUp={handleTimeUp} startedAtMs={examStartTime} />
              </div>
              <Progress value={progress} className="mt-4 w-full" />
            </CardHeader>

            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5"><Save className="h-3.5 w-3.5 text-black" />Progress saved on this device</span>
                {!isOnline && <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-slate-100 px-3 py-1.5 font-bold text-black"><WifiOff className="h-3.5 w-3.5" />Offline — keep this tab open; answers will remain available</span>}
              </div>

              {!isPractice && tabSwitches > 0 && (
                <div className="rounded-xl border border-slate-400 bg-slate-50 p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="mr-2 mt-0.5 h-5 w-5 shrink-0 text-black" />
                    <p className="text-sm leading-6 text-slate-900">Tab or window switching detected ({tabSwitches} event{tabSwitches === 1 ? '' : 's'}).{tabSwitches > 3 && <span className="font-semibold"> Repeated exits may cause this attempt to be reviewed.</span>}</p>
                  </div>
                </div>
              )}

              <section aria-labelledby={`question-${currentQ.id}`}>
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h2 id={`question-${currentQ.id}`} className="text-lg font-semibold leading-7 text-slate-950 sm:text-xl">{currentQ.question}</h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={currentQuestionIsFlagged}
                    onClick={() => toggleFlaggedQuestion(currentQ.id)}
                    className={currentQuestionIsFlagged ? "shrink-0 border-2 border-dashed border-black bg-white text-black hover:bg-slate-100" : "shrink-0"}
                  >
                    <Flag className={`mr-2 h-4 w-4 ${currentQuestionIsFlagged ? "fill-black text-black" : ""}`} />
                    {currentQuestionIsFlagged ? "Flagged for review" : "Flag for review"}
                  </Button>
                </div>

                <RadioGroup value={answers[currentQ.id.toString()]?.toString() || ''} onValueChange={(value) => handleAnswerChange(currentQ.id.toString(), value)} aria-labelledby={`question-${currentQ.id}`}>
                  {currentQ.options.map((option: string, index: number) => {
                    const optionId = `question-${currentQ.id}-option-${index}`;
                    const selected = answers[currentQ.id.toString()] === index;
                    return (
                      <Label
                        key={optionId}
                        htmlFor={optionId}
                        className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm leading-6 transition focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 sm:text-base ${selected ? "border-black bg-slate-100 text-slate-950" : "border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"}`}
                      >
                        <RadioGroupItem value={index.toString()} id={optionId} className="h-5 w-5 shrink-0" />
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${selected ? "bg-black text-white" : "bg-slate-100 text-slate-600"}`}>{String.fromCharCode(65 + index)}</span>
                        <span className="flex-1">{option}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <Button variant="outline" onClick={() => setCurrentQuestion((previous) => Math.max(0, previous - 1))} disabled={currentQuestion === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <span className="order-first w-full text-center text-xs font-semibold text-slate-500 sm:order-none sm:w-auto">{answeredCount}/{questions.length} answered · {flaggedQuestionIds.size} flagged</span>
                <Button onClick={() => setCurrentQuestion((previous) => Math.min(questions.length - 1, previous + 1))} disabled={currentQuestion === questions.length - 1} className="bg-slate-950 text-white hover:bg-slate-800">
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" onClick={() => setSubmitDialogOpen(true)} disabled={submitExamMutation.isPending} className="w-full lg:hidden">
                  <Send className="mr-2 h-4 w-4" />Submit exam
                </Button>
              </div>
            </CardContent>
          </Card>

          <aside className="space-y-3 lg:sticky lg:top-4">
            <QuestionNavigator
              questionIds={questions.map((question) => question.id)}
              currentIndex={currentQuestion}
              answers={answers}
              flaggedQuestionIds={flaggedQuestionIds}
              onNavigate={setCurrentQuestion}
            />
            <Button type="button" onClick={() => setSubmitDialogOpen(true)} disabled={submitExamMutation.isPending} className="hidden h-12 w-full bg-slate-950 text-white hover:bg-slate-800 lg:flex">
              <Send className="mr-2 h-4 w-4" />{submitExamMutation.isPending ? "Submitting…" : "Submit exam"}
            </Button>
            <p className="hidden px-2 text-center text-xs leading-5 text-slate-500 lg:block">You can submit at any time. Unanswered questions will be counted as skipped.</p>
          </aside>
        </div>
      </div>

      <SubmitExamDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        totalQuestions={questions.length}
        answeredQuestions={answeredCount}
        flaggedQuestions={flaggedQuestionIds.size}
        submitting={submitExamMutation.isPending}
        onConfirm={handleSubmit}
      />
      {!isPractice && fullscreenEnforced && <FullscreenExitGuard
        open={!fullscreenActive && !examEndingRef.current && !submitExamMutation.isPending}
        returningToFullscreen={returningToFullscreen}
        submitting={submitExamMutation.isPending}
        onReturnToFullscreen={() => void returnToFullscreen()}
        onSubmit={handleSubmit}
      />}
    </div>
  );
}
