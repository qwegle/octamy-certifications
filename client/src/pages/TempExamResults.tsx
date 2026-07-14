import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Award, Clock, Target, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth.tsx";

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
  userEmail: string;
  userName: string;
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
        title: "Error",
        description: "Failed to load exam results. Please try again.",
        variant: "destructive",
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

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getScoreColor = (score: number, passingScore: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= passingScore) return "text-blue-600";
    return "text-red-600";
  };

  const getBadgeVariant = (passed: boolean, mastered: boolean) => {
    if (mastered) return "default";
    if (passed) return "secondary";
    return "destructive";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {results.passed ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {results.passed ? "Congratulations!" : "Keep Trying!"}
            </h1>
            <p className="text-lg text-muted-foreground">{results.message}</p>
          </div>

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
              onClick={() => navigate(results.course.slug ? `/exam/${results.course.slug}` : "/exams")}
            >
              View Exam
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
