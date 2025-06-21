import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
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
  const { user, token } = useAuth();
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
      const response = await fetch('/api/user/interviews', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch interviews');
      return response.json();
    },
  });

  // Create new interview mutation - redirect to payment
  const createInterviewMutation = useMutation({
    mutationFn: async (technology: string) => {
      setProcessingTech(technology);
      const response = await fetch('/api/interviews/initiate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ technology }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate interview payment');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingTech('');
      if (data.success) {
        toast({
          title: 'Payment Successful',
          description: 'Interview has been unlocked! You can now take the interview.',
        });
        // Refresh the interviews list
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
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-octamy-black mb-2">
            AI Interviews
          </h1>
          <p className="text-xl text-octamy-gray-600">
            Practice technical interviews with AI-powered assessment
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
            <CardTitle>Interview History</CardTitle>
          </CardHeader>
          <CardContent>
            {userInterviews.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No interviews yet</h3>
                <p className="mt-1 text-sm text-gray-500">Start your first AI interview to practice your skills.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userInterviews.map((interview) => (
                  <div key={interview.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-medium">{interview.title}</h3>
                          <p className="text-sm text-gray-500">{interview.technology}</p>
                        </div>
                        <Badge className={getStatusColor(interview.status)}>
                          {interview.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {interview.score && (
                          <div className="text-center">
                            <p className="text-lg font-bold">{interview.score}/100</p>
                            <p className={`text-sm font-medium ${getGradeColor(interview.grade!)}`}>
                              Grade {interview.grade}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex space-x-2">
                          {interview.status === 'pending' && interview.paymentStatus === 'paid' && (
                            <Button size="sm" onClick={() => setLocation(`/interviews/${interview.id}`)}>
                              <Play className="mr-1 h-4 w-4" />
                              Start
                            </Button>
                          )}
                          
                          {interview.status === 'pending' && interview.paymentStatus === 'pending' && (
                            <Button size="sm" onClick={() => setLocation(`/interviews/${interview.id}/payment`)}>
                              Pay ₹99
                            </Button>
                          )}
                          
                          {interview.status === 'completed' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setLocation(`/interviews/${interview.id}/results`)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              View Results
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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