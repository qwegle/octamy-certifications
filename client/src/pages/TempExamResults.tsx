import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Award, Clock, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TempExamResults {
  tempExamId: string;
  score: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  course: {
    id: number;
    title: string;
    passingScore: number;
    price: string;
    originalPrice?: string;
    isOnSale?: boolean;
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
  const { toast } = useToast();

  useEffect(() => {
    if (!tempExamId) {
      navigate("/");
      return;
    }

    fetchTempResults();
  }, [tempExamId]);

  const fetchTempResults = async () => {
    try {
      const response = await fetch(`/api/exam-results-temp/${tempExamId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch exam results");
      }
      
      const data = await response.json();
      setResults(data);
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

  const handleProceedToPayment = async () => {
    if (!results) return;
    
    try {
      setLoading(true);
      
      // Directly initiate PayUMoney payment
      const paymentData = {
        tempExamId,
        courseId: results.course.id,
        amount: results.course.price,
        certificateAmount: results.course.price,
        shippingAmount: "0.00",
        includesPhysicalCopy: false,
        selectedAddressId: null,
        status: "pending",
        paymentMethod: "payumoney"
      };

      const response = await apiRequest("POST", "/api/payment/initiate", paymentData);
      const data = await response.json();
      
      if (data.success && data.paymentForm) {
        // Create and submit the PayUMoney form directly
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.paymentForm.action;
        
        // Add all form fields
        Object.entries(data.paymentForm.fields).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
      } else {
        toast({
          title: "Payment Error",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          {results.passed && results.needsPayment && (
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
            <Button variant="outline" onClick={() => navigate(`/course/${results.course.id}`)}>
              View Course
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}