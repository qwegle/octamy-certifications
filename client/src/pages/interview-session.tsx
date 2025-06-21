import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import Header from '@/components/header';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Clock, 
  Eye,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InterviewQuestion {
  id: number;
  title: string;
  question: string;
  technology: string;
  difficulty: string;
  timeLimit: number;
}

interface Interview {
  id: number;
  technology: string;
  title: string;
  status: string;
  questions?: InterviewQuestion[];
}

export default function InterviewSession() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [tabSwitches, setTabSwitches] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch interview details
  const { data: interview, isLoading } = useQuery<Interview>({
    queryKey: [`/api/interviews/${id}`],
    enabled: !!user && !!token && !!id,
    queryFn: async () => {
      const response = await fetch(`/api/interviews/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch interview');
      return response.json();
    },
  });

  const currentQuestion = interview?.questions?.[currentQuestionIndex];

  // Start video recording
  useEffect(() => {
    if (!currentQuestion) return;

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: videoEnabled, 
          audio: audioEnabled 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        if (audioEnabled) {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start();
          setIsRecording(true);
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: 'Recording Error',
          description: 'Could not start video/audio recording',
          variant: 'destructive',
        });
      }
    };

    startRecording();
    setTimeRemaining(currentQuestion.timeLimit);

    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [currentQuestion, videoEnabled, audioEnabled]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(time => time - 1);
      }, 1000);
    } else if (timeRemaining === 0 && currentQuestion) {
      // Auto-advance to next question when time runs out
      handleNextQuestion();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeRemaining, currentQuestion]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
        toast({
          title: 'Tab Switch Detected',
          description: 'Please stay on this tab during the interview',
          variant: 'destructive',
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleAnswerChange = (answer: string) => {
    if (currentQuestion) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: answer
      }));
    }
  };

  const handleNextQuestion = () => {
    if (interview?.questions && currentQuestionIndex < interview.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Submit interview
      submitInterview();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitInterviewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/interviews/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers,
          tabSwitches,
          completedAt: new Date(),
        }),
      });
      if (!response.ok) throw new Error('Failed to submit interview');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Interview Submitted',
        description: 'Your interview has been submitted successfully',
      });
      setLocation(`/interview-results/${data.id}`);
    },
    onError: () => {
      toast({
        title: 'Submission Failed',
        description: 'Failed to submit interview. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const submitInterview = () => {
    submitInterviewMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Login Required</h2>
          <p>Please log in to access the interview.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Loading Interview...</h2>
        </div>
      </div>
    );
  }

  if (!interview || !currentQuestion) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Interview Not Found</h2>
          <Button onClick={() => setLocation('/ai-interviews')}>
            Back to Interviews
          </Button>
        </div>
      </div>
    );
  }

  const progress = interview.questions ? ((currentQuestionIndex + 1) / interview.questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Interview Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-black">{interview.title}</h1>
            <div className="flex items-center gap-4">
              <Badge variant="outline">{interview.technology}</Badge>
              <div className="flex items-center text-red-600">
                <Clock className="w-4 h-4 mr-1" />
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestionIndex + 1} of {interview.questions?.length}</span>
            <span>Tab switches: {tabSwitches}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recording</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={videoEnabled ? "default" : "outline"}
                      onClick={() => setVideoEnabled(!videoEnabled)}
                    >
                      {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant={audioEnabled ? "default" : "outline"}
                      onClick={() => setAudioEnabled(!audioEnabled)}
                    >
                      {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-40 bg-gray-900 rounded"
                />
                {isRecording && (
                  <div className="flex items-center mt-2 text-red-600">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse mr-2" />
                    Recording
                  </div>
                )}
                
                {tabSwitches > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex items-center text-yellow-800">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      <span className="text-sm">
                        {tabSwitches} tab switch{tabSwitches > 1 ? 'es' : ''} detected
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Question Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{currentQuestion.title}</CardTitle>
                  <Badge className={
                    currentQuestion.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                    currentQuestion.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {currentQuestion.difficulty}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-800 leading-relaxed">
                    {currentQuestion.question}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Your Answer:</label>
                  <Textarea
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Type your answer here..."
                    rows={8}
                    className="w-full"
                  />
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handlePrevQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>

                  {currentQuestionIndex === (interview.questions?.length || 1) - 1 ? (
                    <Button 
                      onClick={submitInterview}
                      disabled={submitInterviewMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {submitInterviewMutation.isPending ? 'Submitting...' : 'Submit Interview'}
                    </Button>
                  ) : (
                    <Button onClick={handleNextQuestion}>
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}