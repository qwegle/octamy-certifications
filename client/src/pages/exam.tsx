import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth.tsx';
import Header from '@/components/header';
import { certificationDisplayTitle } from '@/components/certification-card';
import ExamTimer from '@/components/exam-timer';
import { ExamStructuredData } from '@/components/seo-structured-data';
import { SEO } from '@/components/seo';
import { publicAssessmentCategoryPath, publicAssessmentPath, publicPracticeCategoryPath, publicPracticePath } from '@shared/public-assessment-routes';
import { AlertTriangle, Award, CheckCircle2, ChevronRight, Clock3, FileQuestion, RotateCcw, Save, ShieldCheck, TicketCheck, WifiOff } from 'lucide-react';

interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
}

type SavedExamDraft = {
  version: 1;
  courseId: number;
  slug: string;
  questions: ExamQuestion[];
  sessionId: string;
  answers: Record<string, number>;
  currentQuestion: number;
  examStartTime: number;
  tabSwitches: number;
  userInfo: { name: string; email: string };
  expiresAt: number;
};

type PublicAssessment = {
  id: number;
  title: string;
  description: string;
  slug: string;
  categoryId: number;
  duration: number;
  passingScore: number;
  price: string;
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

export default function Exam() {
  const { slug } = useParams();
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [examStarted, setExamStarted] = useState(false);
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [restoredQuestionsData, setRestoredQuestionsData] = useState<{ questions: ExamQuestion[]; sessionId: string } | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedExamDraft | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [userInfo, setUserInfo] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  const practicePage = location === "/practice" || location.startsWith("/practice/");
  const detailEndpoint = practicePage ? "/api/practice-assessments" : "/api/assessments";
  const { data: course, isLoading: courseLoading, error: courseError } = useQuery<PublicAssessment>({
    queryKey: [detailEndpoint, slug],
    enabled: !!slug,
    retry: false,
    queryFn: async () => (await apiRequest("GET", `${detailEndpoint}/${encodeURIComponent(String(slug || ""))}`)).json(),
  });

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
  } = useQuery<{questions: ExamQuestion[], sessionId: string}>({
    queryKey: [`/api/courses/${course?.id}/questions`, examStarted, examStartTime],
    queryFn: async () => {
      // Always generate a fresh session for each exam attempt
      const newSessionId = `session_${Date.now()}_${Math.random()}`;
      const response = await apiRequest('POST', `/api/courses/${course?.id}/questions`, { sessionId: newSessionId });
      return response.json();
    },
    enabled: !!course?.id && examStarted && !restoredQuestionsData,
    retry: 2,
  });

  const activeQuestionsData = restoredQuestionsData || questionsData;
  const questions = activeQuestionsData?.questions || [];

  // Set session ID when questions data is available
  useEffect(() => {
    if (activeQuestionsData?.sessionId) {
      setSessionId(activeQuestionsData.sessionId);
    }
  }, [activeQuestionsData]);

  useEffect(() => {
    if (!course?.id || typeof window === 'undefined' || examStarted) return;
    const key = `octamy.examDraft.${course.id}`;
    try {
      const draft = JSON.parse(localStorage.getItem(key) || 'null') as SavedExamDraft | null;
      if (
        draft?.version === 1
        && draft.courseId === course.id
        && draft.slug === course.slug
        && draft.expiresAt > Date.now()
        && Array.isArray(draft.questions)
        && draft.questions.length > 0
        && typeof draft.sessionId === 'string'
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
    if (!course?.id || !examStarted || !sessionId || questions.length === 0 || typeof window === 'undefined') return;
    const draft: SavedExamDraft = {
      version: 1,
      courseId: course.id,
      slug: course.slug,
      questions,
      sessionId,
      answers,
      currentQuestion,
      examStartTime,
      tabSwitches,
      userInfo,
      expiresAt: examStartTime + 60 * 60 * 1000,
    };
    localStorage.setItem(`octamy.examDraft.${course.id}`, JSON.stringify(draft));
  }, [answers, course?.id, course?.slug, currentQuestion, examStartTime, examStarted, questions, sessionId, tabSwitches, userInfo]);

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

  // Anti-cheating: Monitor tab/window focus
  useEffect(() => {
    if (!examStarted) return;

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
      if (!active) {
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
  }, [examStarted, isWindowFocused, toast]);

  const submitExamMutation = useMutation({
    mutationFn: async (examData: any) => {
      return apiRequest('POST', '/api/exam/submit', examData);
    },
    onSuccess: async (response) => {
      const result = await response.json();
      
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
    onError: async (error: any) => {
      try {
        const errorData = await error.json();
        if (errorData.code === 'SESSION_EXPIRED') {
          toast({
            title: "Session Expired",
            description: "Your exam session has expired. Please start the exam again.",
            variant: "destructive",
          });
          // Reload the page to restart the exam
          window.location.reload();
        } else {
          toast({
            title: "Error",
            description: errorData.message || "Failed to submit exam. Please try again.",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to submit exam. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const enterFullscreen = async () => {
    if (document.fullscreenElement) return true;
    if (!document.documentElement.requestFullscreen) {
      toast({ title: "Fullscreen unavailable", description: "This browser cannot enter fullscreen. Other browser-integrity events will still be recorded." });
      return false;
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

  const startExam = async () => {
    if (course?.assessmentPurpose === "practice" && !user) {
      setLocation(`/login?next=${encodeURIComponent(location)}`);
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
    
    // Reset state for fresh exam attempt
    setSessionId('');
    setRestoredQuestionsData(null);
    setSavedDraft(null);
    if (course?.id) localStorage.removeItem(`octamy.examDraft.${course.id}`);
    setAnswers({});
    setCurrentQuestion(0);
    setTabSwitches(0);
    setIsWindowFocused(true);
    
    // Invalidate queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: [`/api/courses/${course?.id}/questions`] });
    
    await enterFullscreen();
    setExamStarted(true);
    setExamStartTime(Date.now());
  };

  const resumeSavedExam = async () => {
    if (!savedDraft || savedDraft.expiresAt <= Date.now()) return;
    setRestoredQuestionsData({ questions: savedDraft.questions, sessionId: savedDraft.sessionId });
    setSessionId(savedDraft.sessionId);
    setAnswers(savedDraft.answers || {});
    setCurrentQuestion(Math.min(savedDraft.currentQuestion || 0, savedDraft.questions.length - 1));
    setTabSwitches(savedDraft.tabSwitches || 0);
    setUserInfo(savedDraft.userInfo);
    setExamStartTime(savedDraft.examStartTime);
    await enterFullscreen();
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

  const handleSubmit = () => {
    const timeTaken = Math.floor((Date.now() - examStartTime) / 1000);
    
    // Anti-cheating: Check for excessive tab switching
    if (tabSwitches > 5) {
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
      tabSwitches,
    });
  };

  const handleTimeUp = () => {
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
  const displayTitle = isPractice ? course.title : certificationDisplayTitle(course.title);
  const seoTitle = isPractice ? (course.metaTitle || `${displayTitle} | Octamy Practice`) : (course.metaTitle || `${displayTitle} | Octamy`)
    .replace(/\bPractice\s*\|\s*Octamy Assessments?\b/gi, "Certification Exam | Octamy")
    .replace(/\bAssessments\b/gi, "Certification Exams")
    .replace(/\bAssessment\b/gi, "Certification Exam");
  const metaDescription = course.metaDescription || (isPractice
    ? `Practice ${displayTitle} with rotating questions and answer review. Practice Pass is required to start.`
    : `Take the ${displayTitle} exam free. Review the published passing threshold before you begin; credential activation is optional after a passing result.`);

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SEO title={seoTitle} description={metaDescription} path={canonicalPath} image={course.thumbnailUrl || undefined} />
        
        <ExamStructuredData course={course} />
        
        <Header />
        <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <Link href={isPractice ? "/practice" : course.origin === "creator" ? "/creator-assessments" : "/get-certified"} className="hover:text-slate-950">{isPractice ? "Practice" : course.origin === "creator" ? "Creator certifications" : "Get certified"}</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><Link href={isPractice ? publicPracticeCategoryPath(course.category.slug) : course.origin === "creator" ? `/creator-assessments?category=${encodeURIComponent(course.category.slug)}` : publicAssessmentCategoryPath(course.category.slug)} className="hover:text-slate-950">{course.category.name}</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="max-w-xs truncate font-medium text-slate-800" aria-current="page">{displayTitle}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
            <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl shadow-slate-900/10">
              <div className="relative overflow-hidden px-6 py-9 sm:px-10 sm:py-12">
                <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[48px] border-violet-400/10" />
                <div aria-hidden className="absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="relative">
                  <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.13em]"><Award className="h-3.5 w-3.5 text-violet-300" />{course.originLabel}</span><span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-300">{course.category.name}</span></div>
                  <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-0.04em] sm:text-6xl">{displayTitle}</h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{course.description}</p>
                  <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-violet-200"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{isPractice ? "Practice only. No recruiter credential is issued from this attempt." : course.certificationLabel}</p>
                </div>
              </div>

              <div className="grid border-t border-white/10 bg-white/[0.04] sm:grid-cols-3">
                <div className="flex items-center gap-3 border-b border-white/10 p-5 sm:border-b-0 sm:border-r"><Clock3 className="h-5 w-5 text-violet-300" /><div><p className="text-xs uppercase tracking-wider text-slate-400">Duration</p><p className="mt-1 font-bold">{course.duration} minutes</p></div></div>
                <div className="flex items-center gap-3 border-b border-white/10 p-5 sm:border-b-0 sm:border-r"><FileQuestion className="h-5 w-5 text-sky-300" /><div><p className="text-xs uppercase tracking-wider text-slate-400">Format</p><p className="mt-1 font-bold">Timed MCQ</p></div></div>
                <div className="flex items-center gap-3 p-5"><ShieldCheck className="h-5 w-5 text-emerald-300" /><div><p className="text-xs uppercase tracking-wider text-slate-400">Pass mark</p><p className="mt-1 font-bold">{course.passingScore}% or higher</p></div></div>
              </div>
            </section>

            <aside className="lg:sticky lg:top-28">
              <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 shadow-xl shadow-slate-900/10">
                <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50 to-sky-50 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-800">Start when you are ready</p>
                  <div className="mt-3 flex items-end justify-between gap-4"><div><p className="text-2xl font-black text-slate-950">{isPractice ? "Included in Practice Pass" : "Free exam attempt"}</p><p className="mt-1 text-sm text-slate-600">{isPractice ? "₹299/month unlocks unlimited practice exams." : `Activate the credential for ₹${course.price} only after passing.`}</p></div><CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" /></div>
                </div>
                <CardContent className="space-y-5 p-6">
                  {!user && <div className="space-y-4"><div><Label htmlFor="name" className="font-bold">Full name</Label><input id="name" type="text" autoComplete="name" value={userInfo.name} onChange={(e) => setUserInfo(prev => ({ ...prev, name: e.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100" placeholder="As it should appear on your credential" /></div><div><Label htmlFor="email" className="font-bold">Email address</Label><input id="email" type="email" autoComplete="email" value={userInfo.email} onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100" placeholder="For result recovery" /></div></div>}

                  {savedDraft && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="flex items-start gap-3"><RotateCcw className="mt-0.5 h-5 w-5 text-sky-700" /><div className="min-w-0 flex-1"><h2 className="font-bold text-slate-950">Saved attempt found</h2><p className="mt-1 text-sm leading-5 text-slate-600">{Object.keys(savedDraft.answers).length} of {savedDraft.questions.length} answers saved on this device.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={resumeSavedExam}>Resume exam</Button><Button size="sm" variant="ghost" onClick={discardSavedExam}>Discard</Button></div></div></div></div>}

                  {!savedDraft && <Button onClick={startExam} className="h-12 w-full rounded-full text-base font-black" disabled={!userInfo.name || !userInfo.email}>{isPractice ? "Start practice exam" : "Start certification exam"}</Button>}
                  <ul className="space-y-2.5 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-600"><li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Answers autosave on this device during interruptions.</li><li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Your score and answer review appear after submission.</li><li className="flex gap-2"><TicketCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />{isPractice ? "Practice attempts are not shared as recruiter credentials." : "Direct payment, coupon, or institute voucher can fund activation."}</li></ul>
                </CardContent>
              </Card>
            </aside>
          </div>

          <section className="mt-8 grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:grid-cols-3 sm:p-8" aria-labelledby="certification-process-title">
            <div className="sm:col-span-3"><h2 id="certification-process-title" className="text-xl font-black">How this certification works</h2><p className="mt-1 text-sm text-slate-600">A transparent result first. Credential activation is your choice after passing.</p></div>
            {[{ step: "01", title: "Take the exam", copy: "Stay in this tab and complete the timed questions." }, { step: "02", title: "Review your result", copy: "See the score and the published answer review." }, { step: "03", title: isPractice ? "Repeat and improve" : "Activate the credential", copy: isPractice ? "Practice stays separate from recruiter credentials." : "Pay directly, use a coupon, or redeem an institute voucher." }].map((item) => <div key={item.step} className="rounded-2xl bg-slate-50 p-5"><span className="text-xs font-black text-violet-700">{item.step}</span><h3 className="mt-2 font-black text-slate-950">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{item.copy}</p></div>)}
          </section>
        </main>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div className="min-h-screen bg-cream-deep">
        <SEO title={`${course.title} assessment unavailable`} description={metaDescription} path={canonicalPath} noIndex />
        <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <Card className="border-amber-200 shadow-sm">
            <CardContent className="py-12">
              <AlertTriangle className="mx-auto h-9 w-9 text-amber-600" />
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

  if (questionsLoading || questions.length === 0) {
    return (
    <div className="min-h-screen bg-cream-deep">
      <SEO title={`${course.title} assessment session`} description={metaDescription} path={canonicalPath} noIndex />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="border-cream-deep shadow-sm">
            <CardContent className="text-center py-12">
              <p>Loading exam questions...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-cream-soft">
      <SEO title={`${course.title} assessment session`} description={metaDescription} path={canonicalPath} noIndex />
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-white shadow-sm"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">Proctored assessment</p><p className="mt-0.5 text-sm text-slate-300">Navigation, focus, fullscreen exits, and clipboard actions are monitored.</p></div>{fullscreenActive ? <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-200"><ShieldCheck className="h-4 w-4" />Fullscreen active</span> : <Button type="button" size="sm" variant="secondary" onClick={() => void enterFullscreen()}>Return to fullscreen</Button>}</div>
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4">
              <div>
                <CardTitle className="text-2xl">{course?.title}</CardTitle>
                <p className="text-octamy-gray-600">
                  Question {currentQuestion + 1} of {questions.length}
                </p>
              </div>
              <ExamTimer
                duration={course?.duration || 15}
                onTimeUp={handleTimeUp}
                startedAtMs={examStartTime}
              />
            </div>
            <Progress value={progress} className="w-full" />
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5"><Save className="h-3.5 w-3.5 text-emerald-700" />Progress saved on this device</span>
              {!isOnline && <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900"><WifiOff className="h-3.5 w-3.5" />Offline — keep this tab open; answers will remain available</span>}
            </div>

            {/* Anti-cheating warning */}
            {tabSwitches > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-amber-700" />
                  <p className="text-sm text-amber-900">
                    Tab switching detected ({tabSwitches} times). 
                    {tabSwitches > 3 && <span className="font-semibold"> Warning: Excessive switching may result in exam termination.</span>}
                  </p>
                </div>
              </div>
            )}
            
            <div>
              <h3 className="text-xl font-semibold mb-6">{currentQ.question}</h3>
              
              <RadioGroup
                value={answers[currentQ.id.toString()]?.toString() || ''}
                onValueChange={(value) => handleAnswerChange(currentQ.id.toString(), value)}
              >
                {currentQ.options.map((option: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 p-4 border border-octamy-gray-300 rounded-lg hover:bg-octamy-gray-50 transition-colors">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="flex justify-between items-center pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
              >
                Previous
              </Button>
              
              <div className="text-sm text-octamy-gray-500">
                {answeredCount}/{questions.length} answered
              </div>
              
              {currentQuestion === questions.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitExamMutation.isPending}
                  className="bg-octamy-black text-white hover:bg-octamy-gray-800"
                >
                  {submitExamMutation.isPending ? 'Submitting...' : 'Submit Exam'}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
                  className="bg-octamy-black text-white hover:bg-octamy-gray-800"
                >
                  Next Question
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      

    </div>
  );
}
