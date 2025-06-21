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
  isHandsOn?: boolean;
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
  const [questionTimers, setQuestionTimers] = useState<Record<number, number>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  const [screenChunks, setScreenChunks] = useState<Blob[]>([]);
  
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

  // Start video recording only during active interview
  useEffect(() => {
    if (!currentQuestion || interview?.status === 'completed') return;

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
        
        // Collect video chunks
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setVideoChunks(prev => [...prev, event.data]);
          }
        };
        
        mediaRecorder.start();
        setIsRecording(true);
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
    
    // Auto-start screen recording for hands-on questions
    if (currentQuestion?.isHandsOn && !isScreenRecording) {
      setTimeout(() => startScreenRecording(), 1000);
    }

    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [currentQuestion, videoEnabled, audioEnabled]);

  // Timer countdown with question-specific persistence
  useEffect(() => {
    if (currentQuestion) {
      // Set timer from stored time or default
      const timeLimit = currentQuestion.isHandsOn ? 1800 : currentQuestion.timeLimit;
      const storedTime = questionTimers[currentQuestion.id];
      
      if (storedTime === undefined) {
        setTimeRemaining(timeLimit);
        setQuestionTimers(prev => ({ ...prev, [currentQuestion.id]: timeLimit }));
      } else {
        setTimeRemaining(storedTime);
      }
    }
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (timeRemaining > 0 && currentQuestion) {
      timerRef.current = setTimeout(() => {
        const newTime = timeRemaining - 1;
        setTimeRemaining(newTime);
        setQuestionTimers(prev => ({ ...prev, [currentQuestion.id]: newTime }));
      }, 1000);
    } else if (timeRemaining === 0 && currentQuestion) {
      handleNextQuestion();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeRemaining, currentQuestion]);

  // Tab switch detection and cleanup
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

    const handleBeforeUnload = () => {
      cleanupMedia();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      cleanupMedia();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
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
    // Start screen recording for hands-on questions automatically
    if (interview?.questions && currentQuestionIndex < interview.questions.length - 1) {
      const nextQuestion = interview.questions[currentQuestionIndex + 1];
      setCurrentQuestionIndex(prev => prev + 1);
      
      // Auto-start screen recording for hands-on questions
      if (nextQuestion?.isHandsOn && !isScreenRecording) {
        setTimeout(() => startScreenRecording(), 100);
      }
    } else {
      submitInterview();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Cleanup function for camera and recording
  const cleanupMedia = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
      screenRecorderRef.current.stop();
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsRecording(false);
    setIsScreenRecording(false);
  };

  // Start screen recording for hands-on questions
  const startScreenRecording = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      const mediaRecorder = new MediaRecorder(screenStream);
      screenRecorderRef.current = mediaRecorder;
      
      // Collect screen recording chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setScreenChunks(prev => [...prev, event.data]);
        }
      };
      
      mediaRecorder.start();
      setIsScreenRecording(true);
      
      toast({
        title: 'Screen Recording Started',
        description: 'Your screen is now being recorded for this hands-on question',
      });
    } catch (error) {
      console.error('Error starting screen recording:', error);
      toast({
        title: 'Screen Recording Failed',
        description: 'Unable to start screen recording. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const submitInterviewMutation = useMutation({
    mutationFn: async () => {
      // Stop recording and prepare videos
      cleanupMedia();
      
      let videoUrl = null;
      let screenRecordingUrl = null;
      
      // Create video blob and upload if available
      if (videoChunks.length > 0) {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('video', videoBlob, `interview-${id}-video.webm`);
        formData.append('type', 'video');
        
        const uploadResponse = await fetch(`/api/interviews/${id}/upload-recording`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          videoUrl = uploadResult.url;
        }
      }
      
      // Create screen recording blob and upload if available
      if (screenChunks.length > 0) {
        const screenBlob = new Blob(screenChunks, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('video', screenBlob, `interview-${id}-screen.webm`);
        formData.append('type', 'screen');
        
        const uploadResponse = await fetch(`/api/interviews/${id}/upload-recording`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          screenRecordingUrl = uploadResult.url;
        }
      }
      
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
          videoUrl,
          screenRecordingUrl,
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
      setLocation(`/interviews/${data.id}`);
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

  // Show results if interview is completed
  if (interview && interview.status === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Results Header */}
            <Card className="mb-8">
              <CardContent className="p-8 text-center">
                <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Completed!</h1>
                <p className="text-xl text-gray-600 mb-6">{interview.title}</p>
                
                {/* Score Display */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-4xl font-bold text-blue-600 mb-2">{interview.score || 0}/100</p>
                      <p className="text-gray-600">Overall Score</p>
                    </div>
                    <div>
                      <p className="text-4xl font-bold text-green-600 mb-2">{interview.grade || 'N/A'}</p>
                      <p className="text-gray-600">Grade</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => setLocation('/ai-interviews')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Interviews
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    Print Results
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Interview Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Interview Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600">Technology</p>
                      <p className="font-semibold">{interview.technology}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <Badge className="bg-green-100 text-green-800">Completed</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Completed At</p>
                      <p className="font-semibold">
                        {interview.completedAt ? new Date(interview.completedAt).toLocaleString() : 'Not available'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Questions Answered</p>
                      <p className="font-semibold">{interview.questions?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {interview.aiSummary ? (
                      <div>
                        <p className="text-sm text-gray-600">AI Analysis</p>
                        <p className="text-sm">{interview.aiSummary}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500">Detailed analysis will be available soon.</p>
                    )}
                    
                    {interview.swotAnalysis && (
                      <div>
                        <p className="text-sm text-gray-600">SWOT Analysis</p>
                        <p className="text-sm">{interview.swotAnalysis}</p>
                      </div>
                    )}

                    {/* Video Recordings Section */}
                    {(interview.videoUrl || interview.screenRecordingUrl) && (
                      <div>
                        <p className="text-sm text-gray-600 mb-3">Recordings</p>
                        <div className="space-y-3">
                          {interview.videoUrl && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Camera Recording</p>
                              <video 
                                controls 
                                className="w-full max-w-sm rounded border"
                                preload="metadata"
                              >
                                <source src={interview.videoUrl} type="video/webm" />
                                Your browser does not support video playback.
                              </video>
                            </div>
                          )}
                          
                          {interview.screenRecordingUrl && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Screen Recording (Hands-on)</p>
                              <video 
                                controls 
                                className="w-full max-w-sm rounded border"
                                preload="metadata"
                              >
                                <source src={interview.screenRecordingUrl} type="video/webm" />
                                Your browser does not support video playback.
                              </video>
                            </div>
                          )}
                        </div>
                      </div>
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