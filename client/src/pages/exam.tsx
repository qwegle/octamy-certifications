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
import ExamTimer from '@/components/exam-timer';
import { ExamStructuredData } from '@/components/seo-structured-data';
import { SEO } from '@/components/seo';
import { publicAssessmentCategoryPath, publicAssessmentPath } from '@shared/public-assessment-routes';
import { AlertTriangle, RotateCcw, Save, WifiOff } from 'lucide-react';

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
  canonicalPath: string;
  category: { id: number; name: string; slug: string; kind: string };
  creator: { displayName: string; slug: string } | null;
};

export default function Exam() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
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
  const [userInfo, setUserInfo] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  const { data: course, isLoading: courseLoading, error: courseError } = useQuery<PublicAssessment>({
    queryKey: ["/api/assessments", slug],
    enabled: !!slug,
    retry: false,
    queryFn: async () => (await apiRequest("GET", `/api/assessments/${encodeURIComponent(String(slug || ""))}`)).json(),
  });

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
      const response = await fetch(`/api/courses/${course?.id}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: newSessionId
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to fetch questions');
      }
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

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
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

  const startExam = () => {
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
    
    setExamStarted(true);
    setExamStartTime(Date.now());
  };

  const resumeSavedExam = () => {
    if (!savedDraft || savedDraft.expiresAt <= Date.now()) return;
    setRestoredQuestionsData({ questions: savedDraft.questions, sessionId: savedDraft.sessionId });
    setSessionId(savedDraft.sessionId);
    setAnswers(savedDraft.answers || {});
    setCurrentQuestion(Math.min(savedDraft.currentQuestion || 0, savedDraft.questions.length - 1));
    setTabSwitches(savedDraft.tabSwitches || 0);
    setUserInfo(savedDraft.userInfo);
    setExamStartTime(savedDraft.examStartTime);
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
    return <div className="min-h-screen bg-slate-50"><SEO title="Loading assessment" path={publicAssessmentPath(slug)} noIndex /><Header /><main className="mx-auto max-w-5xl px-5 py-16"><div className="h-96 animate-pulse rounded-3xl bg-slate-200" /></main></div>;
  }

  if (!course || courseError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SEO title="Assessment not found" description="This assessment is unavailable or is no longer public." path={publicAssessmentPath(slug)} noIndex />
        <Header />
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="text-3xl font-black text-slate-950">Assessment unavailable</h1>
          <p className="mt-3 leading-7 text-slate-600">The link may be incorrect, or this assessment is no longer published.</p>
          <Button asChild variant="outline" className="mt-6"><Link href="/assessments">Browse public assessments</Link></Button>
        </main>
      </div>
    );
  }

  const canonicalPath = course.canonicalPath || publicAssessmentPath(course.slug);
  const metaDescription = course.metaDescription || `Take the ${course.title} assessment free. Review the published passing threshold before you begin; credential activation is optional after a passing result.`;

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-cream-deep">
        <SEO title={course.metaTitle || `${course.title} assessment`} description={metaDescription} path={canonicalPath} image={course.thumbnailUrl || undefined} />
        
        <ExamStructuredData course={course} />
        
        <Header />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href={course.origin === "creator" ? "/creator-assessments" : "/assessments"} className="hover:text-slate-950">{course.origin === "creator" ? "Creator assessments" : "Assessments"}</Link><span aria-hidden="true">/</span><Link href={course.origin === "creator" ? `/creator-assessments?category=${encodeURIComponent(course.category.slug)}` : publicAssessmentCategoryPath(course.category.slug)} className="hover:text-slate-950">{course.category.name}</Link><span aria-hidden="true">/</span><span className="font-medium text-slate-800" aria-current="page">{course.title}</span>
          </nav>
          <Card className="border-cream-deep shadow-sm">
            <CardHeader>
              <CardTitle className="text-3xl text-center tracking-tight text-slate-900">
                {course?.title} Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-lg text-slate-600">
                  {course.originLabel} · {course.certificationLabel}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                  <div className="rounded-xl border border-cream-deep bg-cream-soft p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{course?.duration} min</p>
                  </div>
                  <div className="rounded-xl border border-cream-deep bg-cream-soft p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Question Type</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">MCQ</p>
                  </div>
                  <div className="rounded-xl border border-cream-deep bg-cream-soft p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Pass Score</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{course?.passingScore}%+</p>
                  </div>
                  <div className="rounded-xl border border-cream-deep bg-cream-soft p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Certificate</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">Pay after pass</p>
                  </div>
                </div>
                <div className="rounded-xl border border-cream-deep bg-cream-soft p-6">
                  <h3 className="font-semibold mb-4 text-slate-900">Before you start</h3>
                  <ul className="text-left space-y-2 text-sm text-slate-600">
                    <li>• Keep this tab active during the entire assessment.</li>
                    <li>• You cannot pause or restart once the timer begins.</li>
                    <li>• Your score is calculated instantly on submission.</li>
                    <li>• Certificate payment is required only after a passing score.</li>
                  </ul>
                </div>
              </div>

              {!user && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Your Information:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <input
                        id="name"
                        type="text"
                        value={userInfo.name}
                        onChange={(e) => setUserInfo(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <input
                        id="email"
                        type="email"
                        value={userInfo.email}
                        onChange={(e) => setUserInfo(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>
                </div>
              )}

              {savedDraft && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-left">
                  <div className="flex items-start gap-3">
                    <RotateCcw className="mt-0.5 h-5 w-5 text-sky-700" />
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-950">Continue your saved attempt</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {Object.keys(savedDraft.answers).length} of {savedDraft.questions.length} answers are saved securely on this device.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={resumeSavedExam}>Resume assessment</Button>
                        <Button variant="ghost" onClick={discardSavedExam}>Discard saved attempt</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <Button
                  onClick={startExam}
                  className="bg-slate-900 text-white px-10 py-3 text-lg hover:bg-black rounded-full shadow-lg shadow-slate-900/20"
                  disabled={!userInfo.name || !userInfo.email}
                >
                  Start Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div className="min-h-screen bg-cream-deep">
        <SEO title={`${course.title} assessment unavailable`} description={metaDescription} path={canonicalPath} noIndex />
        <Header />
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
      <Header />
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
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
