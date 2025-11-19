import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, IndianRupee, Lock, FileCheck, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/header";
import { Helmet } from "react-helmet-async";

interface TempExamData {
  tempExamId: string;
  course: {
    id: number;
    title: string;
    passingScore: number;
  };
  userEmail: string;
  userName: string;
  timeTaken: number;
  totalQuestions: number;
  hasPayment: boolean;
}

export default function ExamSubmittedPayment() {
  const { tempExamId } = useParams();
  const [location, navigate] = useLocation();
  const [examData, setExamData] = useState<TempExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!tempExamId) {
      navigate("/");
      return;
    }

    fetchExamData();
  }, [tempExamId]);

  const fetchExamData = async () => {
    try {
      const response = await fetch(`/api/exam-results-temp/${tempExamId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch exam data");
      }
      
      const data = await response.json();
      
      // If payment already made, redirect to results
      if (data.hasPayment) {
        navigate(`/exam-results-temp/${tempExamId}`);
        return;
      }
      
      setExamData(data);
    } catch (error) {
      console.error("Error fetching exam data:", error);
      toast({
        title: "Error",
        description: "Failed to load exam information. Please try again.",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentForResults = async () => {
    if (!examData) return;
    
    setPaymentLoading(true);
    
    try {
      const paymentData = {
        tempExamId,
        courseId: examData.course.id,
        userEmail: examData.userEmail,
        userName: examData.userName,
        amount: "29", // INR 29 to view results
        paymentType: "results_viewing", // Different from certificate payment
      };

      const response = await apiRequest("POST", "/api/payment/initiate-results", paymentData);
      const data = await response.json();
      
      if (data.success && data.paymentForm) {
        // Create and submit the payment form
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.paymentForm.action;
        
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
        throw new Error("Failed to initialize payment");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setPaymentLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin w-8 h-8 border-4 border-premcq-black border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!examData) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Exam Not Found</h2>
              <p className="text-premcq-gray-600 mb-4">
                The exam data could not be found or has expired.
              </p>
              <Button onClick={() => navigate("/")} className="w-full bg-premcq-black text-white hover:bg-premcq-gray-800">
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Exam Submitted - PremCq</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Success Message */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-premcq-black">
              Exam Submitted Successfully!
            </h1>
            <p className="text-lg text-premcq-gray-600">
              Your exam has been received and evaluated
            </p>
          </div>

          {/* Exam Info Card */}
          <Card className="mb-6">
            <CardHeader className="bg-premcq-gray-50 border-b">
              <CardTitle className="flex items-center gap-2 text-premcq-black">
                <FileCheck className="h-5 w-5" />
                Exam Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b border-premcq-gray-100">
                  <span className="text-premcq-gray-600">Course:</span>
                  <span className="font-semibold text-premcq-black">{examData.course.title}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-premcq-gray-100">
                  <span className="text-premcq-gray-600">Questions Attempted:</span>
                  <span className="font-semibold text-premcq-black">{examData.totalQuestions}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-premcq-gray-100">
                  <span className="text-premcq-gray-600">Time Taken:</span>
                  <span className="font-semibold text-premcq-black">{formatTime(examData.timeTaken)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-premcq-gray-600">Submitted By:</span>
                  <span className="font-semibold text-premcq-black">{examData.userName}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment to View Results Card */}
          <Card className="border-2 border-premcq-black shadow-lg">
            <CardHeader className="bg-premcq-gray-50 border-b-2 border-premcq-black">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-premcq-black mb-2 flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    View Your Results
                  </CardTitle>
                  <CardDescription className="text-premcq-gray-700">
                    Pay a small fee to unlock your exam score and detailed results
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="bg-premcq-black text-white text-lg px-4 py-2">
                  <IndianRupee className="h-4 w-4 inline mr-1" />
                  29
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-premcq-black">What you'll get:</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-premcq-gray-700">
                      Your complete exam score and percentage
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-premcq-gray-700">
                      Detailed breakdown of correct and incorrect answers
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-premcq-gray-700">
                      Pass/Fail status based on {examData.course.passingScore}% passing score
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-premcq-gray-700">
                      If passed: Option to purchase your professional certificate
                    </span>
                  </li>
                </ul>
              </div>

              <Button 
                onClick={handlePaymentForResults}
                disabled={paymentLoading}
                size="lg"
                className="w-full bg-premcq-black text-white hover:bg-premcq-gray-800 text-lg py-6"
                data-testid="button-pay-for-results"
              >
                {paymentLoading ? (
                  <>
                    <div className="animate-spin mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Pay ₹29 to View Results
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-premcq-gray-500 mt-4">
                Secure payment powered by PayUMoney • One-time fee
              </p>
            </CardContent>
          </Card>

          {/* Back to Home */}
          <div className="text-center mt-8">
            <Button 
              variant="outline" 
              onClick={() => navigate("/")}
              className="border-premcq-gray-300 text-premcq-gray-700 hover:bg-premcq-gray-50"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
