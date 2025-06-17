import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import Header from '@/components/header';
import ExamTimer from '@/components/exam-timer';

import type { Course, Question } from '@shared/schema';
import { AlertTriangle } from 'lucide-react';

interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
}

export default function Exam() {
  const { courseId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [examStarted, setExamStarted] = useState(false);
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [userInfo, setUserInfo] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  const { data: course } = useQuery<Course>({
    queryKey: [`/api/courses/${courseId}`],
    enabled: !!courseId,
  });

  const { data: questionsData } = useQuery<{questions: ExamQuestion[], sessionId: string}>({
    queryKey: [`/api/courses/${courseId}/questions`, sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/courses/${courseId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId || `session_${Date.now()}_${Math.random()}`
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      return response.json();
    },
    enabled: !!courseId && examStarted,
  });

  const questions = questionsData?.questions || [];

  // Set session ID when questions data is available
  useEffect(() => {
    if (questionsData?.sessionId && !sessionId) {
      setSessionId(questionsData.sessionId);
    }
  }, [questionsData, sessionId]);

  // Anti-cheating: Monitor tab/window focus
  useEffect(() => {
    if (!examStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden && isWindowFocused) {
        setTabSwitches(prev => prev + 1);
        setIsWindowFocused(false);
        toast({
          title: "Warning",
          description: "Tab switching detected. Excessive tab switching may result in exam termination.",
          variant: "destructive",
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
      
      if (result.passed) {
        // Create certificate after successful exam
        try {
          const certificateResponse = await apiRequest('POST', '/api/certificates/create', {
            examAttemptId: result.examAttemptId
          });
          
          if (certificateResponse.ok) {
            const certificateData = await certificateResponse.json();
            console.log('Certificate created successfully:', certificateData);
            
            // Redirect to payment page with certificate ID
            setLocation(`/payment/${certificateData.id}`);
          } else {
            const errorData = await certificateResponse.json();
            console.log('Certificate creation response:', errorData);
            
            // Handle different certificate creation errors
            if (errorData.message && errorData.message.includes('already have a certificate')) {
              setLocation(`/payment/${courseId}`);
            } else {
              throw new Error(errorData.message || 'Failed to create certificate');
            }
          }
        } catch (error) {
          console.error('Certificate creation error:', error);
          // Fall back to payment if certificate creation fails
          setLocation(`/payment/${courseId}`);
        }
      } else {
        // Show failure message if exam failed
        toast({
          title: "Exam Failed", 
          description: `You scored ${result.score}%. You need ${result.passingThreshold || 60}% to pass. Please try again.`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit exam. Please try again.",
        variant: "destructive",
      });
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
    
    setExamStarted(true);
    setExamStartTime(Date.now());
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
        title: "Exam Terminated",
        description: "Excessive tab switching detected. Your exam has been flagged for review.",
        variant: "destructive",
      });
    }
    
    submitExamMutation.mutate({
      courseId: parseInt(courseId!),
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

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                {course?.title} - Certification Exam
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-lg text-octamy-gray-600">
                  You are about to take the certification exam for {course?.title}.
                </p>
                <div className="bg-octamy-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold mb-4">Exam Instructions:</h3>
                  <ul className="text-left space-y-2 text-sm text-octamy-gray-600">
                    <li>• Duration: {course?.duration} minutes</li>
                    <li>• Questions: 10-15 multiple choice questions</li>
                    <li>• Passing Score: 50% or higher</li>
                    <li>• You cannot pause or restart the exam once started</li>
                    <li>• Certificate fee: ₹{course?.price} (payable after passing)</li>
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
                        className="w-full mt-1 px-3 py-2 border border-octamy-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-octamy-black"
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
                        className="w-full mt-1 px-3 py-2 border border-octamy-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-octamy-black"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <Button
                  onClick={startExam}
                  className="bg-octamy-black text-white px-8 py-3 text-lg hover:bg-octamy-gray-800"
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

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
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
    <div className="min-h-screen bg-white">
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
              />
            </div>
            <Progress value={progress} className="w-full" />
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Anti-cheating warning */}
            {tabSwitches > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">
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
