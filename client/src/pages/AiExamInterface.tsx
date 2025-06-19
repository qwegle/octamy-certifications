import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Brain, Clock, FileText, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";

interface Question {
  id: number;
  question: string;
  scenario: string;
  maxPoints: number;
  difficulty: string;
}

interface ExamData {
  examAttemptId: number;
  courseTitle: string;
  totalQuestions: number;
  questions: Question[];
  instructions: string;
}

export default function AiExamInterface() {
  const { courseId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (!examData) return;
    
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [examData]);

  // Initialize exam
  useEffect(() => {
    const startExam = async () => {
      try {
        const data = await apiRequest(`/api/ai-exam/${courseId}/start`, {
          method: "POST",
          body: JSON.stringify({
            userEmail: "anonymous@example.com",
            userName: "Anonymous User"
          })
        });

        setExamData(data);
        setIsLoading(false);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to start exam. Please try again.",
          variant: "destructive"
        });
        setLocation("/");
      }
    };

    if (courseId) {
      startExam();
    }
  }, [courseId]);

  const currentQuestion = examData?.questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id || 0] || "";

  const handleAnswerChange = (value: string) => {
    if (currentQuestion) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: value
      }));
    }
  };

  const nextQuestion = () => {
    if (examData && currentQuestionIndex < examData.totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitExam = async () => {
    if (!examData) return;

    setIsSubmitting(true);
    try {
      const response = await apiRequest(`/api/ai-exam/${examData.examAttemptId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers,
          timeElapsed
        })
      });

      toast({
        title: "Exam Submitted",
        description: "Your answers have been submitted for AI evaluation.",
      });

      setLocation(`/ai-exam-results/${examData.examAttemptId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit exam. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredQuestions = examData?.questions.filter(q => answers[q.id]?.trim()).length || 0;
  const progressPercentage = examData ? (answeredQuestions / examData.totalQuestions) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-semibold mb-2">Starting AI Assessment</h3>
              <p className="text-gray-600">Please wait while we prepare your exam...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!examData || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Exam Not Found</h3>
              <p className="text-gray-600 mb-4">Unable to load the exam questions.</p>
              <Button onClick={() => setLocation("/")}>Return Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-6 w-6" />
                  {examData.courseTitle}
                </CardTitle>
                <CardDescription>{examData.instructions}</CardDescription>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Clock className="h-4 w-4" />
                  Time: {formatTime(timeElapsed)}
                </div>
                <Badge variant="outline">
                  {answeredQuestions} of {examData.totalQuestions} answered
                </Badge>
              </div>
            </div>
            <Progress value={progressPercentage} className="mt-4" />
          </CardHeader>
        </Card>

        {/* Question */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Question {currentQuestionIndex + 1} of {examData.totalQuestions}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={currentQuestion.difficulty === 'hard' ? 'destructive' : 
                              currentQuestion.difficulty === 'medium' ? 'default' : 'secondary'}>
                  {currentQuestion.difficulty}
                </Badge>
                <Badge variant="outline">{currentQuestion.maxPoints} points</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-xl mb-3 text-gray-900">{currentQuestion.question}</h3>
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-700 leading-relaxed text-base">{currentQuestion.scenario}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Your Answer:
                </label>
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="Write whatever you feel about this question. Explain your approach, reasoning, algorithm choice, trade-offs, or any solution you have in mind. The AI will analyze your technical understanding and problem-solving skills."
                  className="min-h-[250px] resize-none border-2 border-gray-300 focus:border-blue-500 p-4 text-base"
                  rows={12}
                />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700 font-medium mb-1">
                    💡 Tips for AI Evaluation:
                  </p>
                  <p className="text-xs text-blue-600">
                    Share your thoughts freely - explain your reasoning, discuss different approaches, mention time/space complexity, and consider edge cases. The AI evaluates your technical understanding and problem-solving methodology.
                  </p>
                </div>
              </div>
              
              {currentAnswer.trim() && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Answer recorded ({currentAnswer.trim().length} characters)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {examData.totalQuestions}
            </p>
          </div>

          {currentQuestionIndex < examData.totalQuestions - 1 ? (
            <Button onClick={nextQuestion}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={submitExam} 
              disabled={isSubmitting || answeredQuestions === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Submitting..." : "Submit for AI Evaluation"}
            </Button>
          )}
        </div>

        {/* Question Overview */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Question Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {examData.questions.map((q, index) => (
                <Button
                  key={q.id}
                  variant={index === currentQuestionIndex ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`relative ${answers[q.id]?.trim() ? 'border-green-500' : ''}`}
                >
                  {index + 1}
                  {answers[q.id]?.trim() && (
                    <CheckCircle className="h-3 w-3 absolute -top-1 -right-1 text-green-500" />
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}