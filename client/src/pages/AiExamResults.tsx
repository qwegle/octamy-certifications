import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Brain, CheckCircle, XCircle, Award, Clock, Target, TrendingUp } from "lucide-react";

interface ExamResult {
  id: number;
  courseTitle: string;
  score: number;
  aiTotalScore: number;
  passed: boolean;
  recruitmentReady: boolean;
  timeTaken: number;
  totalQuestions: number;
  answers: Record<string, string>;
  createdAt: string;
}

export default function AiExamResults() {
  const { examAttemptId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [results, setResults] = useState<ExamResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const data = await apiRequest(`/api/ai-exam/${examAttemptId}/results`);
        setResults(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load exam results.",
          variant: "destructive"
        });
        setLocation("/");
      } finally {
        setIsLoading(false);
      }
    };

    if (examAttemptId) {
      fetchResults();
    }
  }, [examAttemptId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Processing Results</h3>
              <p className="text-gray-600">Please wait while we analyze your performance...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Results Not Found</h3>
              <p className="text-gray-600 mb-4">Unable to load your exam results.</p>
              <Button onClick={() => setLocation("/")}>Return Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const answeredQuestions = Object.values(results.answers).filter(answer => answer?.trim()).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {results.passed ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {results.passed ? "Congratulations!" : "Assessment Complete"}
            </CardTitle>
            <CardDescription className="text-lg">
              {results.courseTitle} - AI Technical Assessment Results
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Score Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                <Target className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle className="text-3xl font-bold">
                {results.aiTotalScore}%
              </CardTitle>
              <CardDescription>AI Evaluation Score</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
              <CardTitle className="text-xl">
                {formatTime(results.timeTaken)}
              </CardTitle>
              <CardDescription>Time Taken</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                <Brain className="h-8 w-8 text-purple-500" />
              </div>
              <CardTitle className="text-xl">
                {answeredQuestions} / {results.totalQuestions}
              </CardTitle>
              <CardDescription>Questions Answered</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Performance Analysis */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Overall Performance</span>
                  <span className="text-sm">{results.aiTotalScore}%</span>
                </div>
                <Progress value={results.aiTotalScore} className="mb-4" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Assessment Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {results.passed ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-green-600">Passed</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-600">Not Passed</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {results.recruitmentReady ? (
                        <>
                          <Award className="h-4 w-4 text-blue-500" />
                          <span className="text-blue-600">Recruitment Ready</span>
                        </>
                      ) : (
                        <>
                          <Target className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">More practice needed</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">AI Evaluation</h4>
                  <p className="text-sm text-gray-600">
                    {results.aiTotalScore >= 90 
                      ? "Exceptional technical understanding demonstrated. Ready for senior-level positions."
                      : results.aiTotalScore >= 80
                      ? "Strong technical skills shown. Good candidate for technical roles."
                      : results.aiTotalScore >= 70
                      ? "Solid foundation with room for growth. Consider additional practice."
                      : "Needs improvement in technical concepts. Recommend further study and practice."
                    }
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.passed ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Congratulations!</h4>
                  <p className="text-green-700 mb-3">
                    You've successfully passed the AI technical assessment. Your performance demonstrates solid technical understanding.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="default">Certificate Eligible</Badge>
                    {results.recruitmentReady && <Badge variant="secondary">Recruitment Ready</Badge>}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2">Keep Learning!</h4>
                  <p className="text-orange-700 mb-3">
                    While you didn't pass this time, you've gained valuable experience. Consider reviewing the topics and retaking the assessment.
                  </p>
                  <Badge variant="outline">Retake Available</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => setLocation("/")}>
            Return Home
          </Button>
          {results.passed ? (
            <Button onClick={() => setLocation("/dashboard")}>
              View Dashboard
            </Button>
          ) : (
            <Button onClick={() => setLocation(`/ai-exam/${results.id}`)}>
              Retake Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}