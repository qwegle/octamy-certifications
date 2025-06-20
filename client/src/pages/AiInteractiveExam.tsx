import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Brain, Clock, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";

interface Question {
  id: number;
  question: string;
  scenario: string;
  maxPoints: number;
  difficulty: string;
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ExamData {
  examAttemptId: number;
  courseTitle: string;
  totalQuestions: number;
  questions: Question[];
  instructions: string;
}

export default function AiInteractiveExam() {
  const { courseId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userMessage, setUserMessage] = useState("");
  const [conversations, setConversations] = useState<Record<number, ConversationTurn[]>>({});
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(new Set());
  const [examAttemptId, setExamAttemptId] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Start exam
  const { data: examData, isLoading } = useQuery<ExamData>({
    queryKey: [`/api/ai-exam/${courseId}/start`],
    queryFn: async () => {
      const response = await apiRequest(`/api/ai-exam/${courseId}/start`, {
        method: "POST",
        body: JSON.stringify({
          userEmail: localStorage.getItem("userEmail") || "",
          userName: localStorage.getItem("userName") || ""
        })
      });
      setExamAttemptId(response.examAttemptId);
      return response;
    }
  });

  // AI conversation
  const conversationMutation = useMutation({
    mutationFn: async (data: {
      examAttemptId: number;
      questionId: number;
      userMessage: string;
      conversationHistory: ConversationTurn[];
    }) => {
      return await apiRequest("/api/ai-exam/conversation", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data, variables) => {
      const questionId = variables.questionId;
      setConversations(prev => ({
        ...prev,
        [questionId]: data.conversationHistory
      }));
      
      if (!data.shouldContinue) {
        setCompletedQuestions(prev => new Set([...prev, questionId]));
        toast({
          title: "Question completed",
          description: `AI evaluation complete. Score: ${data.evaluation?.score || 0}%`
        });
      }
      
      setUserMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Communication error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Submit exam
  const submitMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/ai-exam/submit", {
        method: "POST",
        body: JSON.stringify({
          examAttemptId,
          timeTaken: timeElapsed
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Exam submitted successfully",
        description: `Final score: ${data.percentage}%`
      });
      setLocation(`/ai-exam-results/${examAttemptId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMessage = () => {
    if (!userMessage.trim() || !examData || !examAttemptId) return;

    const currentQuestion = examData.questions[currentQuestionIndex];
    const currentConversation = conversations[currentQuestion.id] || [];

    conversationMutation.mutate({
      examAttemptId,
      questionId: currentQuestion.id,
      userMessage,
      conversationHistory: currentConversation
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < (examData?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserMessage("");
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setUserMessage("");
    }
  };

  const submitExam = () => {
    setIsSubmitting(true);
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-lg">Preparing AI Interactive Assessment...</p>
        </div>
      </div>
    );
  }

  if (!examData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg">Failed to load exam</p>
        </div>
      </div>
    );
  }

  const currentQuestion = examData.questions[currentQuestionIndex];
  const currentConversation = conversations[currentQuestion.id] || [];
  const isQuestionCompleted = completedQuestions.has(currentQuestion.id);
  const allQuestionsCompleted = examData.questions.every(q => completedQuestions.has(q.id));

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-400" />
              {examData.courseTitle}
            </h1>
            <p className="text-gray-400">AI Interactive Assessment</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-blue-400">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{formatTime(timeElapsed)}</span>
            </div>
            <Badge variant="outline" className="border-purple-400 text-purple-400">
              Question {currentQuestionIndex + 1} of {examData.questions.length}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Question Panel */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-900 border-gray-800 h-fit">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  Question {currentQuestionIndex + 1}
                  {isQuestionCompleted && <CheckCircle className="w-5 h-5 text-green-400" />}
                </CardTitle>
                <CardDescription>
                  <Badge className={`${currentQuestion.difficulty === 'hard' ? 'bg-red-600' : 
                    currentQuestion.difficulty === 'medium' ? 'bg-yellow-600' : 'bg-green-600'}`}>
                    {currentQuestion.difficulty}
                  </Badge>
                  <span className="ml-2">{currentQuestion.maxPoints} points</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">Question:</h3>
                    <p className="text-gray-300">{currentQuestion.question}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-white mb-2">Scenario:</h3>
                    <p className="text-gray-300 text-sm bg-gray-800 p-3 rounded">
                      {currentQuestion.scenario}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={previousQuestion}
                      disabled={currentQuestionIndex === 0}
                      variant="outline"
                      className="w-full border-gray-600"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex === examData.questions.length - 1}
                      variant="outline"
                      className="w-full border-gray-600"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Overview */}
            <Card className="bg-gray-900 border-gray-800 mt-4">
              <CardHeader>
                <CardTitle className="text-white">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Progress 
                    value={(completedQuestions.size / examData.questions.length) * 100} 
                    className="w-full"
                  />
                  <p className="text-sm text-gray-400">
                    {completedQuestions.size} of {examData.questions.length} questions completed
                  </p>
                  
                  {allQuestionsCompleted && (
                    <Button
                      onClick={submitExam}
                      disabled={isSubmitting || submitMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Exam"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversation Panel */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  AI Interview Conversation
                </CardTitle>
                <CardDescription>
                  Engage with our AI interviewer. Explain your thinking and approach.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Conversation History */}
                <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                  {currentConversation.length === 0 && (
                    <div className="text-center py-8">
                      <Brain className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                      <p className="text-gray-400">Start the conversation by describing your approach to this problem.</p>
                    </div>
                  )}
                  
                  {currentConversation.map((turn, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        turn.role === 'user' 
                          ? 'bg-blue-900/30 ml-8' 
                          : 'bg-purple-900/30 mr-8'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {turn.role === 'user' ? (
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs">
                            U
                          </div>
                        ) : (
                          <Brain className="w-6 h-6 text-purple-400" />
                        )}
                        <span className="text-sm text-gray-400">
                          {turn.role === 'user' ? 'You' : 'AI Interviewer'}
                        </span>
                      </div>
                      <p className="text-white whitespace-pre-wrap">{turn.content}</p>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                {!isQuestionCompleted && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Type your response here... Explain your thought process, ask clarifying questions, or provide your solution approach."
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white min-h-[120px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          sendMessage();
                        }
                      }}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500">
                        Press Ctrl+Enter to send or click the button
                      </p>
                      <Button
                        onClick={sendMessage}
                        disabled={!userMessage.trim() || conversationMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {conversationMutation.isPending ? "Sending..." : "Send Message"}
                      </Button>
                    </div>
                  </div>
                )}

                {isQuestionCompleted && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                    <p className="text-green-400 font-semibold">Question Completed</p>
                    <p className="text-gray-400 text-sm">AI evaluation finished. Move to the next question.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}