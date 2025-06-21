import { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { 
  CheckCircle, ArrowRight, ArrowLeft, Clock, MessageSquare, Monitor, 
  Download, Video, VideoOff, Mic, MicOff, AlertTriangle 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Header component replaced with inline navigation

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
  const { id } = useParams();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(3600); // 1 hour
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // Recording references
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  const [screenChunks, setScreenChunks] = useState<Blob[]>([]);

  // Fetch interview data
  const { data: interview, isLoading } = useQuery({
    queryKey: ['/api/interviews', id],
    queryFn: () => fetch(`/api/interviews/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()),
    enabled: !!token && !!id
  });

  // Submit interview mutation
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
      
      // Submit the interview
      const response = await fetch(`/api/interviews/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          answers,
          tabSwitches,
          completedAt: new Date().toISOString(),
          videoUrl,
          screenRecordingUrl
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit interview');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Interview Submitted",
        description: "Your interview has been submitted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/interviews', id] });
    },
    onError: (error) => {
      console.error('Submit error:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit interview. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Timer effect
  useEffect(() => {
    if (interview?.status === 'in_progress') {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [interview?.status]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && interview?.status === 'in_progress') {
        setTabSwitches(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [interview?.status]);

  // Media recording functions
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
        title: "Recording Error",
        description: "Failed to start recording. Please check your camera permissions.",
        variant: "destructive",
      });
    }
  };

  const startScreenRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      const screenRecorder = new MediaRecorder(stream);
      screenRecorderRef.current = screenRecorder;
      
      screenRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setScreenChunks(prev => [...prev, event.data]);
        }
      };
      
      screenRecorder.start();
      setIsScreenRecording(true);
      
      // Stop screen recording when user stops sharing
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenRecording(false);
        screenRecorder.stop();
      };
    } catch (error) {
      console.error('Error starting screen recording:', error);
      toast({
        title: "Screen Recording Error",
        description: "Failed to start screen recording. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  const cleanupMedia = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    if (screenRecorderRef.current && isScreenRecording) {
      screenRecorderRef.current.stop();
      setIsScreenRecording(false);
    }
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // Navigation functions
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

  if (!interview) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Interview Not Found</h2>
        </div>
      </div>
    );
  }

  const currentQuestion = interview?.questions?.[currentQuestionIndex];

  // Show results if interview is completed
  if (interview.status === 'completed') {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Results Summary */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    Interview Completed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{interview.score || 0}%</div>
                      <div className="text-sm text-gray-600">Score</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{interview.grade || 'N/A'}</div>
                      <div className="text-sm text-gray-600">Grade</div>
                    </div>
                  </div>

                  {interview.aiSummary && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">AI Summary</p>
                      <div className="bg-gray-50 p-3 rounded border text-sm">
                        <p>{interview.aiSummary}</p>
                      </div>
                    </div>
                  )}

                  {interview.swotAnalysis && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">SWOT Analysis</p>
                      <div className="bg-blue-50 p-3 rounded border text-sm">
                        <p>{interview.swotAnalysis}</p>
                      </div>
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
                            <div className="space-y-2">
                              <video 
                                controls 
                                className="w-full max-w-sm rounded border"
                                preload="metadata"
                                playsInline
                                onError={(e) => {
                                  console.error('Video playback error:', e);
                                  const video = e.target as HTMLVideoElement;
                                  video.style.display = 'none';
                                  const errorDiv = document.createElement('div');
                                  errorDiv.className = 'p-4 bg-red-50 text-red-700 rounded border text-sm';
                                  errorDiv.textContent = 'Video format not supported by browser. Please download to view.';
                                  video.parentNode?.insertBefore(errorDiv, video.nextSibling);
                                }}
                              >
                                <source src={interview.videoUrl} type="video/mp4" />
                                <source src={interview.videoUrl} type="video/webm" />
                                Your browser does not support video playback.
                              </video>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const a = document.createElement('a');
                                  a.href = interview.videoUrl!;
                                  a.download = 'interview-video.mp4';
                                  a.click();
                                }}
                                className="w-full"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download Camera Video
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {interview.screenRecordingUrl && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Screen Recording (Hands-on)</p>
                            <div className="space-y-2">
                              <video 
                                controls 
                                className="w-full max-w-sm rounded border"
                                preload="metadata"
                                playsInline
                                onError={(e) => {
                                  console.error('Screen recording playback error:', e);
                                  const video = e.target as HTMLVideoElement;
                                  video.style.display = 'none';
                                  const errorDiv = document.createElement('div');
                                  errorDiv.className = 'p-4 bg-red-50 text-red-700 rounded border text-sm';
                                  errorDiv.textContent = 'Screen recording format not supported. Please download to view.';
                                  video.parentNode?.insertBefore(errorDiv, video.nextSibling);
                                }}
                              >
                                <source src={interview.screenRecordingUrl} type="video/mp4" />
                                <source src={interview.screenRecordingUrl} type="video/webm" />
                                Your browser does not support video playback.
                              </video>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const a = document.createElement('a');
                                  a.href = interview.screenRecordingUrl!;
                                  a.download = 'interview-screen-recording.mp4';
                                  a.click();
                                }}
                                className="w-full"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download Screen Recording
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Audio Transcription and Detailed Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Responses & Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <InterviewResponsesDisplay interviewId={interview.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show active interview interface
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

// Component to display interview responses with audio transcription
const InterviewResponsesDisplay = ({ interviewId }: { interviewId: number }) => {
  const { data: responses, isLoading } = useQuery({
    queryKey: ['/api/interview-responses', interviewId],
    queryFn: () => fetch(`/api/interview-responses/${interviewId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(res => res.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!responses || responses.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No detailed responses available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {responses.map((response: any, index: number) => (
        <div key={response.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
            <div className="text-right">
              <span className="text-sm text-gray-500">Total Score: </span>
              <span className="font-semibold text-blue-600">{response.aiScore || 'N/A'}/100</span>
            </div>
          </div>
          
          {/* Score Breakdown */}
          {(response.introductionScore || response.technicalScore) && (
            <div className="mb-3 grid grid-cols-2 gap-4">
              {response.introductionScore && (
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="text-sm font-medium text-green-700">Introduction</div>
                  <div className="text-lg font-bold text-green-600">{response.introductionScore}/20</div>
                </div>
              )}
              {response.technicalScore && (
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className="text-sm font-medium text-blue-700">Technical</div>
                  <div className="text-lg font-bold text-blue-600">{response.technicalScore}/{response.introductionScore ? '80' : '100'}</div>
                </div>
              )}
            </div>
          )}
          
          {response.audioTranscription && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">Audio Transcription:</p>
              <div className="bg-gray-50 p-3 rounded border text-sm">
                {response.audioTranscription}
              </div>
            </div>
          )}
          
          {response.screenAnalysis && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">Screen Recording Analysis:</p>
              <div className="bg-orange-50 p-3 rounded border text-sm">
                {response.screenAnalysis}
              </div>
            </div>
          )}
          
          {response.aiAnalysis && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">AI Technical Analysis:</p>
              <div className="bg-blue-50 p-3 rounded border text-sm">
                {response.aiAnalysis}
              </div>
            </div>
          )}
          
          {response.timeSpent && (
            <div className="text-xs text-gray-500">
              Time spent: {Math.floor(response.timeSpent / 60)}m {response.timeSpent % 60}s
            </div>
          )}
        </div>
      ))}
    </div>
  );
};