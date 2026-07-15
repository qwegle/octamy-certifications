import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Award, Clock, Target, Loader2, ShieldCheck, Mail, TicketCheck, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth.tsx";

type ReviewItem = {
  questionId: number;
  question: string;
  options: string[];
  selectedAnswer: number | null;
  correctAnswer: number;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
};

interface TempExamResults {
  tempExamId: string;
  score: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  course: {
    id: number;
    slug?: string;
    title: string;
    passingScore: number;
    price: string;
    originalPrice?: string;
    isOnSale?: boolean;
    ownerType?: string;
    subscriptionEligible?: boolean;
    certificationMode?: string;
  };
  timeTaken: number;
  mastered: boolean;
  isRetake: boolean;
  previousBestScore: number;
  review: ReviewItem[];
  isGuest: boolean;
  maskedEmail?: string;
  resultExpiresAt?: string;
  recoveryEmailSent: boolean;
  message: string;
  needsPayment: boolean;
}

export default function TempExamResults() {
  const { tempExamId } = useParams();
  const [location, navigate] = useLocation();
  const [results, setResults] = useState<TempExamResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [learnerPlanActive, setLearnerPlanActive] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  const { user, token } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!tempExamId) {
      navigate("/");
      return;
    }

    fetchTempResults();
  }, [tempExamId, token]);

  const fetchTempResults = async () => {
    try {
      const response = await apiRequest("GET", `/api/exam-results-temp/${tempExamId}`);
      const data = await response.json();
      setResults(data);
      if (token) {
        const subscriptionResponse = await apiRequest("GET", "/api/me/subscription");
        const subscriptionData = await subscriptionResponse.json();
        setLearnerPlanActive(subscriptionData?.learner?.plan === "all_access" && subscriptionData?.learner?.status === "active");
      }
    } catch (error) {
      console.error("Error fetching temp results:", error);
      toast({
        title: "Results unavailable",
        description: "Failed to load exam results. Please try again.",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToPayment = () => {
    if (!results) return;
    
    // Navigate to payment with temporary exam data
    const paymentUrl = `/payment?tempExamId=${tempExamId}&courseId=${results.course.id}`;
    navigate(paymentUrl);
  };

  const redeemSubscriptionCredential = async () => {
    if (!results || !tempExamId) return;
    if (!user || !token) {
      navigate(`/login?next=${encodeURIComponent(`/exam-results-temp/${tempExamId}`)}`);
      return;
    }
    setRedeeming(true);
    try {
      const response = await apiRequest("POST", "/api/subscriptions/learner/redeem", { tempExamId });
      const data = await response.json();
      toast({ title: "Credential issued", description: "Your All Access benefit was applied securely." });
      navigate(data.redirectTo || `/certificate/${data.certificateId}`);
    } catch (error) {
      toast({
        title: "Credential not issued",
        description: error instanceof Error ? error.message : "Please retry from your results page.",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  };

  const redeemInstituteVoucher = async () => {
    if (!results || !tempExamId || !voucherCode.trim()) return;
    setRedeemingVoucher(true);
    try {
      const response = await apiRequest("POST", "/api/certification-vouchers/redeem", {
        tempExamId,
        code: voucherCode.trim(),
      });
      const data = await response.json();
      toast({ title: "Voucher applied", description: "Your institute-sponsored credential has been issued." });
      navigate(data.redirectTo || `/certificate/${data.certificateId}`);
    } catch (error) {
      toast({
        title: "Voucher was not applied",
        description: error instanceof Error ? error.message : "Check the code or ask your institute administrator.",
      });
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getScoreColor = (score: number, passingScore: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= passingScore) return "text-blue-600";
    return "text-amber-700";
  };

  const getBadgeVariant = (passed: boolean, mastered: boolean) => {
    if (mastered) return "default";
    if (passed) return "secondary";
    return "secondary";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Results Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The exam results could not be found or have expired.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ec]">
      <div className="container mx-auto px-4 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {results.passed ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-amber-600" />
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {results.passed ? "Congratulations!" : "Keep Trying!"}
            </h1>
            <p className="text-lg text-muted-foreground">{results.message}</p>
          </div>

          {results.isGuest && (
            <Card className="mb-6 overflow-hidden border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-900/10">
              <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-sm font-bold text-sky-300"><Mail className="h-4 w-4" />{results.recoveryEmailSent ? `Recovery link sent ${results.maskedEmail ? `to ${results.maskedEmail}` : "to your email"}` : "Your result is saved for 24 hours"}</div>
                  <h2 className="mt-2 text-xl font-extrabold">Keep this result in your learner record</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Create a free account or sign in with the same email. You can return to this result, use an eligible subscription benefit, and keep future credentials together.</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button onClick={() => navigate(`/register?role=learner&next=${encodeURIComponent(`/exam-results-temp/${tempExamId}`)}`)} className="bg-white text-slate-950 hover:bg-slate-100"><UserPlus className="mr-2 h-4 w-4" />Create free account</Button>
                  <Button variant="outline" onClick={() => navigate(`/login?next=${encodeURIComponent(`/exam-results-temp/${tempExamId}`)}`)} className="border-slate-600 bg-transparent text-white hover:bg-slate-800 hover:text-white">Sign in</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Score Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Score Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(results.score, results.course.passingScore)}`}>
                      {results.score}%
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {results.correctAnswers} out of {results.totalQuestions} correct
                    </p>
                  </div>
                  
                  <Progress value={results.score} className="h-3" />
                  
                  <div className="flex justify-between text-sm">
                    <span>Passing Score: {results.course.passingScore}%</span>
                    <Badge variant={getBadgeVariant(results.passed, results.mastered)}>
                      {results.mastered ? "Mastered" : results.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exam Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Exam Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Course:</span>
                    <span className="font-medium">{results.course.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Taken:</span>
                    <span className="font-medium">{formatTime(results.timeTaken)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Questions:</span>
                    <span className="font-medium">{results.totalQuestions}</span>
                  </div>
                  {results.isRetake && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Previous Best:</span>
                      <span className="font-medium">{results.previousBestScore}%</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {results.review?.length > 0 && (
            <Card className="mt-6 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Answer review</CardTitle>
                <CardDescription>Review every response before your next attempt. Correct answers are shown for learning and improvement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.review.map((item, index) => (
                  <details key={item.questionId} className={`group rounded-2xl border p-4 ${item.isCorrect ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                    <summary className="flex cursor-pointer list-none items-start gap-3 font-semibold text-slate-950">
                      {item.isCorrect ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
                      <span className="flex-1">{index + 1}. {item.question}</span>
                      <Badge variant="outline" className={item.isCorrect ? "border-emerald-300 text-emerald-800" : "border-amber-300 text-amber-900"}>{item.isCorrect ? "Correct" : item.selectedAnswer == null ? "Not answered" : "Review"}</Badge>
                    </summary>
                    <div className="ml-8 mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl bg-white/80 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your answer</p><p className="mt-1 font-medium text-slate-800">{item.selectedOption || "No answer selected"}</p></div>
                      <div className="rounded-xl bg-white/80 p-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Correct answer</p><p className="mt-1 font-medium text-slate-900">{item.correctOption}</p></div>
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Card */}
          {results.passed && results.course.subscriptionEligible && learnerPlanActive && (
            <Card className="mt-6 border-emerald-200 bg-emerald-50/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-950"><ShieldCheck className="h-5 w-5" />Included with Learner All Access</CardTitle>
                <CardDescription>Your passing Octamy in-house assessment includes digital credential activation. No student checkout is required.</CardDescription>
              </CardHeader>
              <CardContent><Button onClick={redeemSubscriptionCredential} disabled={redeeming} size="lg" className="bg-emerald-800 text-white hover:bg-emerald-900">{redeeming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Issue my included credential</Button></CardContent>
            </Card>
          )}

          {results.passed && results.course.subscriptionEligible && !learnerPlanActive && (
            <Card className="mt-6 border-violet-200 bg-violet-50/60">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-950">This Octamy assessment is included in All Access</p><p className="mt-1 text-sm text-slate-600">₹1,999/month covers eligible in-house assessment credentials. Creator products are not included.</p></div><Button variant="outline" onClick={() => navigate("/pricing")}>View All Access</Button></CardContent>
            </Card>
          )}

          {results.passed && results.needsPayment && !(results.course.subscriptionEligible && learnerPlanActive) && (
            <Card className="mt-6 overflow-hidden border-violet-200 bg-white shadow-sm">
              <CardHeader className="border-b border-violet-100 bg-violet-50/70">
                <CardTitle className="flex items-center gap-2 text-violet-950"><TicketCheck className="h-5 w-5" />Have an institute certification voucher?</CardTitle>
                <CardDescription>A valid voucher sponsors the credential after a passing result. It does not change your score or exam evidence.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="sr-only" htmlFor="certification-voucher">Certification voucher code</label>
                  <input id="certification-voucher" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} placeholder="OCT-XXXXXXXXXX-XXXXXX" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm uppercase tracking-wide outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                  <Button onClick={redeemInstituteVoucher} disabled={redeemingVoucher || voucherCode.trim().length < 16} className="h-11 rounded-xl px-6">
                    {redeemingVoucher && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Redeem voucher
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">Assigned vouchers must match the learner email used for this exam. Each code can issue one credential only.</p>
              </CardContent>
            </Card>
          )}

          {results.passed && results.needsPayment && !(results.course.subscriptionEligible && learnerPlanActive) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Get Your Certificate
                </CardTitle>
                <CardDescription>
                  Complete your payment to receive your verified certificate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <div className="text-lg font-semibold">
                      {results.course.isOnSale && results.course.originalPrice ? (
                        <div>
                          <span className="line-through text-muted-foreground mr-2">
                            ₹{results.course.originalPrice}
                          </span>
                          <span className="text-green-600">₹{results.course.price}</span>
                        </div>
                      ) : (
                        <span>₹{results.course.price}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Professional Certificate
                    </p>
                  </div>
                  <Button onClick={handleProceedToPayment} size="lg" className="min-w-[200px]">
                    Proceed to Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="mt-8 text-center space-x-4">
            <Button variant="outline" onClick={() => navigate("/")}>
              Go Home
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(results.course.slug ? `/get-certified/${results.course.slug}` : "/get-certified")}
            >
              View Exam
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
