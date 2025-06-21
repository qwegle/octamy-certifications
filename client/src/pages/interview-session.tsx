import { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { 
  Clock, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle,
  Brain,
  FileText,
  Target,
  Download,
  User
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
  const { user } = useAuth();
  
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

  // Fetch interview responses for completed interviews
  const { data: responses } = useQuery({
    queryKey: ['/api/interview-responses', interviewId],
    queryFn: () => fetch(`/api/interview-responses/${interviewId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(res => res.json()),
    enabled: !!interviewId && interview?.status === 'completed',
  });

  // Show interview completion with detailed results
  if (interview?.status === 'completed') {
    const getGradeColor = (grade: string) => {
      switch (grade) {
        case 'A+': case 'A': return 'bg-green-100 text-green-800';
        case 'B+': case 'B': return 'bg-blue-100 text-blue-800';
        case 'C+': case 'C': return 'bg-yellow-100 text-yellow-800';
        case 'D+': case 'D': return 'bg-orange-100 text-orange-800';
        default: return 'bg-red-100 text-red-800';
      }
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-black">Interview Results</h1>
            <Button 
              variant="outline" 
              onClick={() => navigate('/ai-interviews')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Interviews
            </Button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          {/* Interview Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{interview.title}</CardTitle>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-gray-600">Technology: {interview.technology}</p>
                    {user && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{user.name}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{interview.score || 0}/100</div>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(interview.grade || 'F')}`}>
                    Grade {interview.grade || 'F'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="font-semibold">{interview.completedAt ? formatDate(interview.completedAt) : 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Questions</p>
                  <p className="font-semibold">{interview.totalQuestions || 0}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <p className="font-semibold capitalize">{interview.paymentStatus}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          {interview.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Analysis Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{interview.aiSummary}</p>
              </CardContent>
            </Card>
          )}

          {/* Video & Screen Recording */}
          {(interview.videoUrl || interview.screenRecordingUrl) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Recordings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {interview.videoUrl && (
                  <div>
                    <h4 className="font-semibold mb-2">Video Recording</h4>
                    <div className="relative">
                      <video 
                        controls 
                        className="w-full max-w-2xl rounded-lg shadow-lg"
                        poster="/api/placeholder/800/450"
                        preload="metadata"
                        controlsList="nodownload"
                        onError={(e) => {
                          console.error('Video error:', e);
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }}
                      >
                        <source src={interview.videoUrl} type="video/mp4" />
                        <source src={interview.videoUrl.replace(/\.[^/.]+$/, '.webm')} type="video/webm" />
                        <source src={interview.videoUrl.replace(/\.[^/.]+$/, '.ogg')} type="video/ogg" />
                        Your browser does not support the video tag.
                      </video>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200" style={{display: 'none'}}>
                        <p className="text-yellow-800 text-center">
                          Video format not supported by your browser. 
                          <a href={interview.videoUrl} download className="text-blue-600 hover:underline ml-1">
                            Download the video file
                          </a>
                        </p>
                        <p className="text-yellow-600 text-sm text-center mt-2">
                          Try using Chrome, Firefox, or Safari for better video compatibility.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {interview.screenRecordingUrl && (
                  <div>
                    <h4 className="font-semibold mb-2">Screen Recording</h4>
                    <div className="relative">
                      <video 
                        controls 
                        className="w-full max-w-2xl rounded-lg shadow-lg"
                        poster="/api/placeholder/800/450"
                        preload="metadata"
                        controlsList="nodownload"
                        onError={(e) => {
                          console.error('Screen recording error:', e);
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }}
                      >
                        <source src={interview.screenRecordingUrl} type="video/mp4" />
                        <source src={interview.screenRecordingUrl.replace(/\.[^/.]+$/, '.webm')} type="video/webm" />
                        <source src={interview.screenRecordingUrl.replace(/\.[^/.]+$/, '.ogg')} type="video/ogg" />
                        Your browser does not support the video tag.
                      </video>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200" style={{display: 'none'}}>
                        <p className="text-yellow-800 text-center">
                          Screen recording format not supported by your browser. 
                          <a href={interview.screenRecordingUrl} download className="text-blue-600 hover:underline ml-1">
                            Download the video file
                          </a>
                        </p>
                        <p className="text-yellow-600 text-sm text-center mt-2">
                          Try using Chrome, Firefox, or Safari for better video compatibility.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Question-wise Analysis */}
          {responses && responses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Question-wise Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {responses.map((response: any, index: number) => (
                    <div key={response.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-lg">Question {index + 1}</h4>
                        <div className="flex gap-2">
                          {response.introductionScore && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                              Intro: {response.introductionScore}%
                            </span>
                          )}
                          {response.technicalScore && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                              Technical: {response.technicalScore}%
                            </span>
                          )}
                          {response.aiScore && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
                              AI Score: {response.aiScore}/100
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded mb-3">
                        <p className="font-medium text-gray-900">{response.question}</p>
                        {response.questionType && (
                          <span className="inline-block mt-2 bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                            {response.questionType}
                          </span>
                        )}
                      </div>

                      {response.audioTranscription && (
                        <div className="mb-3">
                          <h5 className="font-medium text-gray-700 mb-2">Your Response (Transcribed):</h5>
                          <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                            <p className="text-gray-800">{response.audioTranscription}</p>
                          </div>
                        </div>
                      )}

                      {response.screenAnalysis && (
                        <div className="mb-3">
                          <h5 className="font-medium text-gray-700 mb-2">Screen Activity Analysis:</h5>
                          <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                            <p className="text-gray-800">{response.screenAnalysis}</p>
                          </div>
                        </div>
                      )}

                      {response.aiAnalysis && (
                        <div className="mb-3">
                          <h5 className="font-medium text-gray-700 mb-2">AI Feedback:</h5>
                          <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                            <p className="text-gray-800">{response.aiAnalysis}</p>
                          </div>
                        </div>
                      )}

                      {response.timeSpent && (
                        <div className="text-sm text-gray-600">
                          Time spent: {Math.round(response.timeSpent / 1000)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SWOT Analysis */}
          {interview.swotAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  SWOT Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">Strengths</h4>
                    <p className="text-green-700 text-sm">{interview.swotAnalysis}</p>
                  </div>
                  {/* Add more SWOT sections as needed */}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => navigate('/ai-interviews')} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              Back to Interviews
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.print()}
            >
              <Download className="w-4 h-4 mr-2" />
              Print Results
            </Button>
          </div>
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