import { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle 
} from 'lucide-react';

interface InterviewQuestion {
  id: number;
  title: string;
  question: string;
  technology: string;
  difficulty: string;
  timeLimit: number;
  isHandsOn?: boolean;
}

interface Interview {
  id: number;
  technology: string;
  title: string;
  status: string;
  questions?: InterviewQuestion[];
  videoUrl?: string;
  screenRecordingUrl?: string;
  score?: number;
  grade?: string;
  aiSummary?: string;
  swotAnalysis?: string;
}

export default function InterviewSession() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600); // 1 hour
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);

  // Extract interview ID from URL - check both patterns
  const [matchInterview, paramsInterview] = useRoute('/interview/:id');
  const [matchInterviews, paramsInterviews] = useRoute('/interviews/:id');
  const [matchResults, paramsResults] = useRoute('/interview-results/:id');
  
  const interviewId = paramsInterview?.id ? parseInt(paramsInterview.id) : 
                     paramsInterviews?.id ? parseInt(paramsInterviews.id) :
                     paramsResults?.id ? parseInt(paramsResults.id) : null;

  // Fetch interview data
  const { data: interview, isLoading, error } = useQuery({
    queryKey: ['/api/interviews', interviewId],
    queryFn: () => fetch(`/api/interviews/${interviewId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(res => res.json()),
    enabled: !!interviewId,
  });

  // Timer countdown
  useEffect(() => {
    if (!interviewStarted) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          submitInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [interviewStarted]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && interviewStarted) {
        setTabSwitches(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [interviewStarted]);

  // Format time helper
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start video recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoEnabled, 
        audio: audioEnabled 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Recording Error",
        description: "Could not start video recording. Please check your camera permissions.",
        variant: "destructive",
      });
    }
  };

  // Start screen recording
  const startScreenRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
      });

      const screenRecorder = new MediaRecorder(stream);
      screenRecorderRef.current = screenRecorder;
      
      screenRecorder.start();
      setIsScreenRecording(true);
    } catch (error) {
      toast({
        title: "Screen Recording Error",
        description: "Could not start screen recording. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  // Submit interview mutation
  const submitInterviewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/interviews/${interviewId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          answers,
          tabSwitches,
          timeSpent: 3600 - timeRemaining
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interviews', interviewId] });
      toast({
        title: "Interview Submitted",
        description: "Your interview has been submitted successfully!",
      });
      navigate('/ai-interviews');
    },
    onError: () => {
      toast({
        title: "Submission Error",
        description: "Failed to submit interview. Please try again.",
        variant: "destructive",
      });
    }
  });

  const submitInterview = () => {
    // Stop recordings
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (screenRecorderRef.current && isScreenRecording) {
      screenRecorderRef.current.stop();
      setIsScreenRecording(false);
    }
    
    submitInterviewMutation.mutate();
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (interview?.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  if (!interviewId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Interview</h2>
            <p className="text-gray-600 mb-4">No interview ID provided.</p>
            <Button onClick={() => navigate('/ai-interviews')}>
              Back to Interviews
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show interview completion
  if (interview?.status === 'completed') {
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-black">Interview Completed</h1>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Submitted Successfully!</h2>
              <p className="text-gray-600 mb-4">
                Your responses are being processed by our AI system. You'll receive detailed feedback soon.
              </p>
              <Button onClick={() => navigate('/ai-interviews')}>
                Back to Interviews
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !interview) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Interview Not Found</h2>
            <p className="text-gray-600 mb-4">
              The interview session you're looking for doesn't exist or has expired.
            </p>
            <Button onClick={() => navigate('/ai-interviews')}>
              Back to Interviews
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show pre-interview preparation
  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-black">Octamy | AI Interview</h1>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Interview Preparation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Get ready for your {interview.technology} interview. Make sure your camera and microphone are working properly.</p>
              <Button onClick={() => setInterviewStarted(true)}>
                Start Interview
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show active interview interface
  const progress = interview.questions ? ((currentQuestionIndex + 1) / interview.questions.length) * 100 : 0;
  const currentQuestion = interview.questions?.[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-black">Octamy | AI Interview</h1>
        </div>
      </header>
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
                
                {!isRecording && (
                  <Button
                    onClick={startRecording}
                    size="sm"
                    className="mt-2 w-full"
                  >
                    Start Recording
                  </Button>
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
            {currentQuestion && (
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
                  {/* Screen Recording Warning for Hands-on Questions */}
                  {currentQuestion.isHandsOn && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-orange-800 mb-1">Screen Recording Notice</h4>
                          <p className="text-sm text-orange-700">
                            This is a hands-on coding question. Your screen will be recorded during this question to evaluate your problem-solving approach and coding skills.
                          </p>
                          {!isScreenRecording && (
                            <Button
                              onClick={startScreenRecording}
                              size="sm"
                              className="mt-2 bg-orange-600 hover:bg-orange-700"
                            >
                              Start Screen Recording
                            </Button>
                          )}
                          {isScreenRecording && (
                            <div className="flex items-center mt-2 text-orange-700">
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
                              Screen recording in progress
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">{currentQuestion.question}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Answer
                    </label>
                    <textarea
                      value={answers[currentQuestionIndex] || ''}
                      onChange={(e) => setAnswers(prev => ({
                        ...prev,
                        [currentQuestionIndex]: e.target.value
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={8}
                      placeholder="Type your answer here..."
                    />
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between items-center pt-4">
                    <Button 
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      variant="outline"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}