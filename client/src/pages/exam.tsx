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
import { useAuth } from '@/lib/auth.tsx';
import Header from '@/components/header';
import ExamTimer from '@/components/exam-timer';
import { Helmet } from 'react-helmet-async';
import { ExamStructuredData } from '@/components/seo-structured-data';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { Course, Question } from '@shared/schema';
import { AlertTriangle, Flag, Wifi, WifiOff, Maximize, Check, Circle, Clock } from 'lucide-react';

interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
  subject?: string | null; // For multi-subject exams
}

interface SubjectInfo {
  name: string;
  questionCount: number;
}

interface ExamProgress {
  answers: Record<string, number>;
  flaggedQuestions: number[];
  currentQuestion: number;
  examStartTime: number;
  sessionId: string;
  courseId: number;
  userInfo: { name: string; email: string };
  tabSwitches: number;
  questions: ExamQuestion[]; // Cache questions for offline use
}

// Simple encryption using base64 and XOR (for basic obfuscation)
const STORAGE_KEY = 'exam_progress_encrypted';
const SECRET_KEY = 'premcq_exam_2024_secure';

function encryptData(data: ExamProgress): string {
  const jsonStr = JSON.stringify(data);
  let encrypted = '';
  for (let i = 0; i < jsonStr.length; i++) {
    encrypted += String.fromCharCode(
      jsonStr.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length)
    );
  }
  return btoa(encrypted);
}

function decryptData(encrypted: string): ExamProgress | null {
  try {
    const decoded = atob(encrypted);
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      decrypted += String.fromCharCode(
        decoded.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length)
      );
    }
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt exam data:', error);
    return null;
  }
}

function saveToLocalStorage(progress: ExamProgress): void {
  try {
    const encrypted = encryptData(progress);
    localStorage.setItem(STORAGE_KEY, encrypted);
  } catch (error) {
    console.error('Failed to save exam progress:', error);
  }
}

function loadFromLocalStorage(): ExamProgress | null {
  try {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (!encrypted) return null;
    return decryptData(encrypted);
  } catch (error) {
    console.error('Failed to load exam progress:', error);
    return null;
  }
}

function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export default function Exam() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [examStarted, setExamStarted] = useState(false);
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string>('');
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedQuestions, setCachedQuestions] = useState<ExamQuestion[]>([]);
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [userInfo, setUserInfo] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });
  
  // Multi-subject exam state
  const [currentSubject, setCurrentSubject] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectInfo[] | null>(null);
  
  // Confirmation dialog state
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);

  const { data: course } = useQuery<Course>({
    queryKey: [`/api/courses/slug/${slug}`],
    enabled: !!slug,
  });

  const { data: questionsData } = useQuery<{
    questions: ExamQuestion[];
    sessionId: string;
    subjects?: SubjectInfo[] | null;
  }>({
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
        throw new Error('Failed to fetch questions');
      }
      return response.json();
    },
    enabled: !!course?.id && examStarted && !isResumingSession, // Don't fetch if resuming
  });

  // Use cached questions if available, otherwise use fetched questions
  const questions = cachedQuestions.length > 0 ? cachedQuestions : (questionsData?.questions || []);

  // Set session ID and subjects when questions data is available
  useEffect(() => {
    if (questionsData?.sessionId) {
      setSessionId(questionsData.sessionId);
    }
    if (questionsData?.subjects) {
      setSubjects(questionsData.subjects);
      // Set first subject as default for multi-subject exams
      if (questionsData.subjects.length > 0 && !currentSubject) {
        setCurrentSubject(questionsData.subjects[0].name);
      }
    }
  }, [questionsData, currentSubject]);
  
  // Check if this is a multi-subject exam
  const isMultiSubject = subjects && subjects.length > 0;
  
  // Filter questions by current subject (for multi-subject exams)
  const displayQuestions = isMultiSubject && currentSubject
    ? questions.filter(q => q.subject === currentSubject)
    : questions;

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Back Online",
        description: "Internet connection restored. You can submit your exam now.",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Offline Mode",
        description: "No internet connection. Your progress is being saved locally.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Auto-save exam progress to encrypted local storage
  useEffect(() => {
    if (examStarted && course?.id && sessionId && questions.length > 0) {
      const progress: ExamProgress = {
        answers,
        flaggedQuestions: Array.from(flaggedQuestions),
        currentQuestion,
        examStartTime,
        sessionId,
        courseId: course.id,
        userInfo,
        tabSwitches,
        questions, // Save questions for offline use
      };
      saveToLocalStorage(progress);
    }
  }, [answers, flaggedQuestions, currentQuestion, examStarted, examStartTime, sessionId, course?.id, userInfo, tabSwitches, questions]);

  // Load saved progress on mount
  useEffect(() => {
    const savedProgress = loadFromLocalStorage();
    if (savedProgress && course?.id && savedProgress.courseId === course.id) {
      // Prompt user to resume
      const shouldResume = window.confirm(
        'You have an incomplete exam session. Would you like to resume where you left off?'
      );
      
      if (shouldResume && savedProgress.questions && savedProgress.questions.length > 0) {
        // Restore all state including cached questions
        setIsResumingSession(true);
        setCachedQuestions(savedProgress.questions);
        setAnswers(savedProgress.answers);
        setFlaggedQuestions(new Set(savedProgress.flaggedQuestions));
        setCurrentQuestion(savedProgress.currentQuestion);
        setExamStartTime(savedProgress.examStartTime);
        setSessionId(savedProgress.sessionId);
        setUserInfo(savedProgress.userInfo);
        setTabSwitches(savedProgress.tabSwitches);
        setExamStarted(true);
        
        toast({
          title: "Session Resumed",
          description: "Your exam progress has been restored. You can continue offline if needed.",
        });
      } else {
        clearLocalStorage();
      }
    }
  }, [course?.id, toast]);

  // Enter fullscreen when exam starts
  useEffect(() => {
    if (examStarted && !isResumingSession) {
      const enterFullscreen = async () => {
        try {
          const elem = document.documentElement;
          if (elem.requestFullscreen) {
            await elem.requestFullscreen();
          } else {
            toast({
              title: "Fullscreen Not Available",
              description: "For the best exam experience, please maximize your browser window.",
              variant: "default",
            });
          }
        } catch (error) {
          console.log('Fullscreen request failed:', error);
          toast({
            title: "Fullscreen Request Failed",
            description: "Please manually enter fullscreen mode (F11) or maximize your browser for the best exam experience.",
            variant: "default",
          });
        }
      };
      
      enterFullscreen();
    }
  }, [examStarted, isResumingSession, toast]);

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
      
      // Redirect to exam submitted page - payment required to view results
      if (result.tempExamId) {
        setLocation(`/exam-submitted/${result.tempExamId}`);
      } else {
        // Fallback for any edge cases
        toast({
          title: "Exam Submitted",
          description: "Your exam has been submitted successfully.",
          variant: "default",
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
    setAnswers({});
    setCurrentQuestion(0);
    setTabSwitches(0);
    setIsWindowFocused(true);
    setCachedQuestions([]);
    setIsResumingSession(false);
    setFlaggedQuestions(new Set());
    
    // Clear any saved progress
    clearLocalStorage();
    
    // Invalidate queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: [`/api/courses/${course?.id}/questions`] });
    
    setExamStarted(true);
    setExamStartTime(Date.now());
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: parseInt(answer)
    }));
  };

  const toggleFlag = (questionId: number) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // Show confirmation dialog before submitting
  const handleSubmit = () => {
    // Check internet connection before showing confirmation
    if (!isOnline || !navigator.onLine) {
      toast({
        title: "No Internet Connection",
        description: "Please connect to the internet to submit your exam. Your progress is saved locally.",
        variant: "destructive",
      });
      return;
    }
    
    // Show confirmation dialog
    setShowSubmitConfirmation(true);
  };
  
  // Actually submit the exam after confirmation
  const confirmSubmit = () => {
    const timeTaken = Math.floor((Date.now() - examStartTime) / 1000);
    
    // Anti-cheating: Check for excessive tab switching
    if (tabSwitches > 5) {
      toast({
        title: "Exam Terminated",
        description: "Excessive tab switching detected. Your exam has been flagged for review.",
        variant: "destructive",
      });
    }
    
    // Clear local storage after successful submission
    clearLocalStorage();
    
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log('Exit fullscreen failed:', err));
    }
    
    setShowSubmitConfirmation(false);
    
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
    // Exit fullscreen when time is up
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log('Exit fullscreen failed:', err));
    }
    
    toast({
      title: "Time's Up!",
      description: "Your exam has been auto-submitted.",
    });
    
    // Auto-submit without confirmation when time runs out
    confirmSubmit();
  };

  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  const courseSlug = course?.slug || course?.title.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-white">
        <Helmet>
          <title>{course?.title ? `${course.title} - Certification Exam | PremCq` : 'Certification Exam | PremCq'}</title>
          <meta name="description" content={course?.title ? `Take the ${course.title} certification exam and earn your professional credential. Comprehensive assessment with instant results.` : 'Take your certification exam and earn your professional credential.'} />
          <meta property="og:title" content={course?.title ? `${course.title} - Certification Exam | PremCq` : 'Certification Exam | PremCq'} />
          <meta property="og:description" content={course?.title ? `Take the ${course.title} certification exam and earn your professional credential.` : 'Take your certification exam and earn your professional credential.'} />
          <meta property="og:url" content={`${window.location.origin}/exam/${courseSlug}`} />
          <link rel="canonical" href={`${window.location.origin}/exam/${courseSlug}`} />
        </Helmet>
        
        {course && <ExamStructuredData course={course} rating={{ averageRating: "4.5", totalReviews: 0, rating1Count: 0, rating2Count: 0, rating3Count: 0, rating4Count: 0, rating5Count: 0 }} />}
        
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
                <p className="text-lg text-premcq-gray-600">
                  You are about to take the certification exam for {course?.title}.
                </p>
                <div className="bg-premcq-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold mb-4">Exam Instructions:</h3>
                  <ul className="text-left space-y-2 text-sm text-premcq-gray-600">
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
                        className="w-full mt-1 px-3 py-2 border border-premcq-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-premcq-black"
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
                        className="w-full mt-1 px-3 py-2 border border-premcq-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-premcq-black"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <Button
                  onClick={startExam}
                  className="bg-premcq-black text-white px-8 py-3 text-lg hover:bg-premcq-gray-800"
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
    <div className="min-h-screen bg-gradient-to-b from-white to-premcq-gray-50">
      {/* Elegant Top Bar */}
      <div className="bg-white border-b border-premcq-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Left: Course Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 bg-premcq-black rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{currentQuestion + 1}</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-premcq-gray-900">{course?.title}</h2>
                  <p className="text-xs text-premcq-gray-500">Question {currentQuestion + 1} of {questions.length}</p>
                </div>
              </div>
            </div>

            {/* Right: Timer and Status */}
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`} data-testid="connection-status">
                {isOnline ? (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-700">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-600" />
                    <span className="text-xs font-medium text-red-700">Offline</span>
                  </>
                )}
              </div>
              
              {/* Timer */}
              <div className="flex items-center gap-2 px-4 py-1.5 bg-premcq-black text-white rounded-full">
                <Clock className="h-4 w-4" />
                <ExamTimer
                  duration={course?.duration || 15}
                  onTimeUp={handleTimeUp}
                />
              </div>
              
              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                className="bg-red-600 text-white hover:bg-red-700"
                data-testid="button-submit-exam"
              >
                Submit Exam
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="pb-2">
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>
      </div>
      
      {/* Multi-Subject Tabs */}
      {isMultiSubject && subjects && (
        <div className="bg-white border-b border-premcq-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto py-3">
              {subjects.map((subject) => {
                const subjectQuestions = questions.filter(q => q.subject === subject.name);
                const answeredInSubject = subjectQuestions.filter(q => answers[q.id.toString()] !== undefined).length;
                const isActive = currentSubject === subject.name;
                
                return (
                  <button
                    key={subject.name}
                    onClick={() => {
                      setCurrentSubject(subject.name);
                      // Jump to first question of this subject
                      const firstQuestionIndex = questions.findIndex(q => q.subject === subject.name);
                      if (firstQuestionIndex !== -1) {
                        setCurrentQuestion(firstQuestionIndex);
                      }
                    }}
                    className={`flex-shrink-0 px-6 py-3 rounded-md font-medium transition-all ${
                      isActive
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-premcq-gray-100 text-premcq-gray-800 hover:bg-premcq-gray-200'
                    }`}
                    data-testid={`tab-subject-${subject.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="text-left">
                      <div className="font-semibold">{subject.name}</div>
                      <div className="text-xs mt-1">
                        {subject.questionCount} Questions • {answeredInSubject} Answered
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Main Exam Content - Left Side */}
          <Card className="flex-1 shadow-md">
            <CardContent className="space-y-6 pt-6">
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
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-semibold flex-1">{currentQ.question}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFlag(currentQ.id)}
                  className={`ml-4 ${flaggedQuestions.has(currentQ.id) ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : ''}`}
                  data-testid={`button-flag-${currentQ.id}`}
                >
                  <Flag className={`h-4 w-4 ${flaggedQuestions.has(currentQ.id) ? 'fill-yellow-500' : ''}`} />
                  {flaggedQuestions.has(currentQ.id) ? 'Flagged' : 'Flag'}
                </Button>
              </div>
              
              <RadioGroup
                value={answers[currentQ.id.toString()]?.toString() || ''}
                onValueChange={(value) => handleAnswerChange(currentQ.id.toString(), value)}
              >
                {currentQ.options.map((option: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 p-4 border border-premcq-gray-300 rounded-lg hover:bg-premcq-gray-50 transition-colors">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} data-testid={`radio-option-${index}`} />
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
              
              <div className="text-sm text-premcq-gray-500">
                {answeredCount}/{questions.length} answered
              </div>
              
              {currentQuestion === questions.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitExamMutation.isPending}
                  className="bg-premcq-black text-white hover:bg-premcq-gray-800"
                >
                  {submitExamMutation.isPending ? 'Submitting...' : 'Submit Exam'}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
                  className="bg-premcq-black text-white hover:bg-premcq-gray-800"
                >
                  Next Question
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question Overview Panel - Right Side */}
        <Card className="w-80 h-fit sticky top-4">
          <CardHeader>
            <CardTitle className="text-lg">
              {isMultiSubject && currentSubject ? `${currentSubject} - Questions` : 'Question Overview'}
            </CardTitle>
            <p className="text-sm text-premcq-gray-600">
              {isMultiSubject && currentSubject ? (
                <>
                  {displayQuestions.filter(q => answers[q.id.toString()] !== undefined).length} of {displayQuestions.length} answered
                </>
              ) : (
                <>{answeredCount} of {questions.length} answered</>
              )}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {(isMultiSubject && currentSubject ? displayQuestions : questions).map((q, displayIndex) => {
                // For multi-subject, find actual index in full questions array
                const actualIndex = questions.findIndex(question => question.id === q.id);
                const isAnswered = answers[q.id.toString()] !== undefined;
                const isFlagged = flaggedQuestions.has(q.id);
                const isCurrent = actualIndex === currentQuestion;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestion(actualIndex)}
                    data-testid={`question-nav-${displayIndex + 1}`}
                    className={`
                      relative w-12 h-12 rounded-md border-2 flex items-center justify-center text-sm font-semibold transition-all
                      ${isCurrent ? 'border-black bg-black text-white' : ''}
                      ${!isCurrent && isAnswered ? 'border-green-500 bg-green-50 text-green-700' : ''}
                      ${!isCurrent && !isAnswered ? 'border-gray-300 bg-white text-gray-700 hover:border-gray-400' : ''}
                    `}
                  >
                    {displayIndex + 1}
                    {isFlagged && (
                      <Flag className="absolute -top-1 -right-1 h-3 w-3 fill-yellow-500 text-yellow-500" />
                    )}
                    {isAnswered && !isCurrent && (
                      <Check className="absolute -bottom-1 -right-1 h-3 w-3 text-green-600 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-green-500 bg-green-50"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-gray-300 bg-white"></div>
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 border-black bg-black"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span>Flagged for Review</span>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
      
      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitConfirmation} onOpenChange={setShowSubmitConfirmation}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">Confirm Exam Submission</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Please review your exam summary before final submission. Once submitted, you cannot make any changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Overall Statistics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Overall Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Total Questions</span>
                    <span className="text-2xl font-bold">{questions.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Answered</span>
                    <span className="text-2xl font-bold text-green-600">{answeredCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Unanswered</span>
                    <span className="text-2xl font-bold text-red-600">{questions.length - answeredCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Flagged for Review</span>
                    <span className="text-2xl font-bold text-yellow-600">{flaggedQuestions.size}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Subject-wise Statistics (for multi-subject exams) */}
            {isMultiSubject && subjects && subjects.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Subject-wise Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {subjects.map((subject) => {
                      const subjectQuestions = questions.filter(q => q.subject === subject.name);
                      const subjectAnswered = subjectQuestions.filter(q => answers[q.id.toString()] !== undefined).length;
                      const subjectFlagged = subjectQuestions.filter(q => flaggedQuestions.has(q.id)).length;
                      
                      return (
                        <div key={subject.name} className="border-b last:border-0 pb-3 last:pb-0">
                          <div className="font-semibold text-base mb-2">{subject.name}</div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total: </span>
                              <span className="font-medium">{subject.questionCount}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Answered: </span>
                              <span className="font-medium text-green-600">{subjectAnswered}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Flagged: </span>
                              <span className="font-medium text-yellow-600">{subjectFlagged}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Warning if unanswered questions */}
            {answeredCount < questions.length && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900">Unanswered Questions</p>
                  <p className="text-sm text-yellow-800">
                    You have {questions.length - answeredCount} unanswered question(s). 
                    Unanswered questions will be marked as incorrect.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSubmitConfirmation(false)}>
              Go Back to Exam
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSubmit}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Final Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
