import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { 
  Video, 
  Clock, 
  Target, 
  TrendingUp, 
  Brain, 
  Award,
  Play,
  CheckCircle,
  XCircle,
  Eye,
  ArrowLeft,
  Star,
  Users,
  Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Interview, InterviewQuestion } from '@shared/schema';

export default function AIInterviews() {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const [, setLocation] = useLocation();
  const [selectedTechnology, setSelectedTechnology] = useState<string>('');
  const [processingTech, setProcessingTech] = useState<string>('');
  const { toast } = useToast();

  // Fetch available technologies and interview questions
  const { data: technologies = [], isLoading: technologiesLoading, error: technologiesError } = useQuery<string[]>({
    queryKey: ['/api/interview-technologies'],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      console.log('Fetching technologies...');
      const response = await fetch('/api/interview-technologies');
      console.log('Response status:', response.status);
      if (!response.ok) throw new Error('Failed to fetch technologies');
      const data = await response.json();
      console.log('Technologies API response:', data);
      console.log('Technologies array:', Array.isArray(data));
      console.log('Technologies count:', data.length);
      return data;
    },
  });

  // Fetch user's interviews
  const { data: userInterviews = [], refetch: refetchInterviews } = useQuery<Interview[]>({
    queryKey: ['/api/user/interviews'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const currentToken = localStorage.getItem('token');
      const response = await fetch('/api/user/interviews', {
        headers: { 'Authorization': `Bearer ${currentToken}` },
      });
      if (!response.ok) throw new Error('Failed to fetch interviews');
      return response.json();
    },
  });

  // Create new interview mutation - redirect to payment
  const createInterviewMutation = useMutation({
    mutationFn: async (technology: string) => {
      setProcessingTech(technology);
      const currentToken = localStorage.getItem('token');
      console.log('Current token for payment:', currentToken ? 'Token exists' : 'No token');
      
      const response = await fetch('/api/interviews/initiate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ technology }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment initiation failed:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to initiate interview payment');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingTech('');
      if (data.redirectToPayment && data.paymentForm) {
        // Create and submit PayUMoney form
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.paymentForm;
        document.body.appendChild(tempDiv);
        const form = tempDiv.querySelector('form') as HTMLFormElement;
        if (form) {
          form.submit();
        }
        document.body.removeChild(tempDiv);
      } else if (data.alreadyPurchased) {
        toast({
          title: 'Already Purchased',
          description: 'You have already purchased this interview.',
        });
        refetchInterviews();
      } else if (data.success) {
        toast({
          title: 'Payment Successful',
          description: 'Interview has been unlocked!',
        });
        refetchInterviews();
      }
    },
    onError: (error: Error) => {
      setProcessingTech('');
      console.error('Interview payment initiation failed:', error);
      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to initiate payment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'expired': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade?.startsWith('A')) return 'text-green-600';
    if (grade?.startsWith('B')) return 'text-blue-600';
    if (grade?.startsWith('C')) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-octamy-black mb-4">Login Required</h2>
            <p className="text-octamy-gray-600">Please log in to access AI Interviews.</p>
            <Link href="/auth">
              <Button className="mt-4">Login</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back to Dashboard Button */}
        <div className="mb-8">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/dashboard')}
            className="flex items-center gap-2 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-octamy-black mb-2">
            AI Interviews
          </h1>
          <p className="text-xl text-octamy-gray-600">
            Practice technical interviews with AI-powered assessment and boost your career prospects
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Video className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Interviews</p>
                  <p className="text-2xl font-bold text-gray-900">{userInterviews.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {userInterviews.filter(i => i.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {userInterviews.length > 0 
                      ? Math.round(userInterviews
                          .filter(i => i.score)
                          .reduce((acc, i) => acc + i.score!, 0) / 
                          userInterviews.filter(i => i.score).length) || 0
                      : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Best Grade</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {userInterviews.filter(i => i.grade).length > 0 
                      ? userInterviews
                          .filter(i => i.grade)
                          .sort((a, b) => (a.grade! > b.grade! ? -1 : 1))[0]?.grade || 'N/A'
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Technologies */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="mr-2 h-5 w-5" />
              Available Technologies
            </CardTitle>
            <p className="text-sm text-gray-600">
              Choose a technology for your AI interview (₹99 per interview)
            </p>
          </CardHeader>
          <CardContent>
            {technologiesLoading ? (
              <div className="text-center py-8">
                <Brain className="mx-auto h-12 w-12 text-gray-400 animate-pulse" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Loading technologies...</h3>
                <p className="mt-1 text-sm text-gray-500">Fetching available interview technologies.</p>
              </div>
            ) : technologies.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No technologies available</h3>
                <p className="mt-1 text-sm text-gray-500">Interview technologies are being set up.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {technologies.map((tech) => (
                  <Card key={tech} className="cursor-pointer border-2 hover:border-black transition-colors">
                    <CardContent className="p-6 text-center">
                      <h3 className="font-semibold text-lg mb-2 text-black">{tech}</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Technical interview for {tech} development
                      </p>
                      <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
                        <Clock className="mr-1 h-4 w-4" />
                        5-7 questions • 45-60 min
                      </div>
                      {userInterviews.some(interview => interview.technology === tech && interview.isPaid) ? (
                        <Button 
                          onClick={() => setLocation(`/interview/${userInterviews.find(i => i.technology === tech && i.isPaid)?.id}`)}
                          className="w-full bg-green-600 text-white hover:bg-green-700"
                        >
                          Take Interview
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => createInterviewMutation.mutate(tech)}
                          disabled={processingTech === tech}
                          className="w-full bg-black text-white hover:bg-gray-800 transition-all"
                        >
                          {processingTech === tech ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Processing...
                            </div>
                          ) : (
                            'Start Interview - ₹99'
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interview History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Interview History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userInterviews.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="mx-auto h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No interviews yet</h3>
                <p className="mt-2 text-gray-500">Start your first AI interview to practice your skills and build your portfolio.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userInterviews.map((interview) => (
                  <Card key={interview.id} className="border-2 hover:border-gray-300 transition-colors">
                    <CardContent className="p-6">
                      {/* Video Placeholder */}
                      <div className="relative mb-4">
                        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                          {interview.videoUrl ? (
                            <video 
                              className="w-full h-full object-cover rounded-lg"
                              poster="/api/placeholder/400/225"
                            >
                              <source src={interview.videoUrl} type="video/mp4" />
                            </video>
                          ) : (
                            <div className="text-center">
                              <Video className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="text-sm text-gray-500 mt-2">
                                {interview.status === 'completed' ? 'Video Processing' : 'No Video'}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Status Badge */}
                        <Badge 
                          className={`absolute top-2 right-2 ${getStatusColor(interview.status)}`}
                        >
                          {interview.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>

                      {/* Interview Details */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{interview.title}</h3>
                          <p className="text-gray-600">{interview.technology}</p>
                        </div>

                        {/* Score Display */}
                        {interview.score ? (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-2xl font-bold text-gray-900">{interview.score}/100</p>
                                <p className="text-sm text-gray-600">Final Score</p>
                              </div>
                              <div className="text-right">
                                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(interview.grade!)}`}>
                                  Grade {interview.grade}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 rounded-lg p-4">
                            <p className="text-yellow-800 text-sm">
                              {interview.paymentStatus === 'pending' ? 'Payment required to start' : 'Ready to begin'}
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          {interview.status === 'pending' && interview.paymentStatus === 'paid' && (
                            <Button 
                              className="flex-1"
                              onClick={() => setLocation(`/interviews/${interview.id}`)}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Start Interview
                            </Button>
                          )}
                          
                          {interview.status === 'pending' && interview.paymentStatus === 'pending' && (
                            <Button 
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                              onClick={() => createInterviewMutation.mutate(interview.technology)}
                            >
                              Pay ₹99
                            </Button>
                          )}
                          
                          {interview.status === 'completed' && (
                            <>
                              <Button 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => setLocation(`/interviews/${interview.id}/results`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Results
                              </Button>
                              {interview.videoUrl && (
                                <Button 
                                  variant="outline"
                                  onClick={() => window.open(interview.videoUrl, '_blank')}
                                >
                                  <Video className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Interview Date */}
                        <p className="text-xs text-gray-500 pt-2">
                          {interview.completedAt 
                            ? `Completed on ${new Date(interview.completedAt).toLocaleDateString()}`
                            : `Created on ${new Date(interview.createdAt).toLocaleDateString()}`
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}