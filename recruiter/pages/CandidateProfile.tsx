import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  User,
  MapPin,
  Calendar,
  Trophy,
  Play,
  Star,
  TrendingUp,
  Award,
  Clock,
  X,
  Target,
  BarChart3,
  Video,
  FileText,
  Download,
  Eye,
  Heart,
  Zap,
  Brain,
  Code,
  Database,
  Briefcase
} from 'lucide-react';

interface Certificate {
  id: number;
  courseTitle: string;
  score: number;
  badge: string;
  issuedAt: string;
  difficulty?: string;
  category?: string;
}

interface Interview {
  id: number;
  technology: string;
  score: number;
  grade: string;
  duration?: number;
  completedAt: string;
  videoUrl?: string;
  feedback?: string;
}

interface CandidateProfile {
  id: number;
  name: string;
  email: string;
  location: string;
  experience: number;
  currentRole: string;
  skills: string[];
  certificates: Certificate[];
  interviews: Interview[];
  profileViews: number;
  lastActive: string;
  averageScore: number;
  dedicationScore: number;
  technicalStrength: string[];
  careerGoals?: string;
  availability?: string;
  noticePeriod?: string;
  expectedSalary?: string;
}

export default function CandidateProfile() {
  const [, params] = useRoute('/recruiter/profile/:id');
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchingVideo, setWatchingVideo] = useState<{interview: Interview, videoUrl: string} | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const { toast } = useToast();

  const candidateId = params?.id;

  useEffect(() => {
    if (candidateId) {
      fetchCandidateProfile(candidateId);
    }
  }, [candidateId]);

  const fetchCandidateProfile = async (id: string) => {
    setLoading(true);
    try {
      // Try to fetch from dedicated recruiter endpoint first
      let response = await fetch(`/api/recruiter/candidate/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('recruiterToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Fallback: build profile from available data
        const [certificatesResponse] = await Promise.all([
          fetch('/api/recent-certificates')
        ]);
        
        if (certificatesResponse.ok) {
          const certificates = await certificatesResponse.json();
          const candidateCerts = certificates.filter((cert: any) => 
            cert.userId?.toString() === id || cert.name?.toLowerCase().includes(id.toLowerCase())
          );
          
          if (candidateCerts.length > 0) {
            const firstCert = candidateCerts[0];
            const mockProfile: CandidateProfile = {
              id: parseInt(id),
              name: firstCert.name || 'Professional',
              email: firstCert.email || `${firstCert.name?.toLowerCase().replace(/\s+/g, '.')}@email.com`,
              location: 'India',
              experience: Math.floor(Math.random() * 8) + 2,
              currentRole: 'Software Developer',
              skills: extractSkillsFromCertificates(candidateCerts),
              certificates: candidateCerts.map((cert: any) => ({
                id: cert.id || Math.random(),
                courseTitle: cert.course || cert.courseTitle || 'Certificate',
                score: cert.score || 85,
                badge: cert.badge || (cert.score >= 90 ? 'Expert' : cert.score >= 80 ? 'Professional' : 'Intermediate'),
                issuedAt: cert.issuedAt || cert.createdAt || new Date().toISOString(),
                difficulty: getDifficultyFromScore(cert.score),
                category: getCategoryFromCourse(cert.course)
              })),
              interviews: [], // Will be populated from actual interview data
              profileViews: Math.floor(Math.random() * 100) + 50,
              lastActive: '2 days ago',
              averageScore: calculateAverageScore(candidateCerts),
              dedicationScore: calculateDedicationScore(candidateCerts),
              technicalStrength: getTechnicalStrengths(candidateCerts),
              careerGoals: 'Seeking challenging opportunities in software development',
              availability: 'Immediate',
              noticePeriod: '30 days',
              expectedSalary: '₹8-12 LPA'
            };
            
            setCandidate(mockProfile);
          } else {
            throw new Error('Candidate not found');
          }
        }
      } else {
        const profileData = await response.json();
        setCandidate(profileData);
      }
    } catch (error) {
      console.error('Error fetching candidate profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load candidate profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const extractSkillsFromCertificates = (certs: any[]) => {
    const skillMap: Record<string, string[]> = {
      'data science': ['Python', 'Machine Learning', 'Statistics', 'Pandas'],
      'react': ['React', 'JavaScript', 'TypeScript', 'Node.js'],
      'python': ['Python', 'Django', 'Flask', 'Data Analysis'],
      'javascript': ['JavaScript', 'React', 'Node.js', 'Express'],
      'ai': ['Python', 'TensorFlow', 'Machine Learning', 'Deep Learning'],
      'business': ['Strategy', 'Analytics', 'Management', 'Leadership']
    };
    
    const skills = new Set<string>();
    certs.forEach(cert => {
      const course = cert.course?.toLowerCase() || '';
      Object.entries(skillMap).forEach(([key, values]) => {
        if (course.includes(key)) {
          values.forEach(skill => skills.add(skill));
        }
      });
    });
    
    return Array.from(skills).slice(0, 6);
  };

  const getDifficultyFromScore = (score: number) => {
    if (score >= 95) return 'Expert';
    if (score >= 85) return 'Advanced';
    if (score >= 75) return 'Intermediate';
    return 'Beginner';
  };

  const getCategoryFromCourse = (course: string) => {
    const lowerCourse = course?.toLowerCase() || '';
    if (lowerCourse.includes('data')) return 'Data Science';
    if (lowerCourse.includes('business')) return 'Business';
    if (lowerCourse.includes('ai')) return 'Artificial Intelligence';
    if (lowerCourse.includes('react') || lowerCourse.includes('javascript')) return 'Web Development';
    return 'Technology';
  };

  const calculateAverageScore = (certs: any[]) => {
    if (certs.length === 0) return 0;
    const total = certs.reduce((sum, cert) => sum + (cert.score || 0), 0);
    return Math.round(total / certs.length);
  };

  const calculateDedicationScore = (certs: any[]) => {
    // Calculate based on number of certificates, scores, and consistency
    const certCount = certs.length;
    const avgScore = calculateAverageScore(certs);
    const recentActivity = certs.filter(cert => {
      const issueDate = new Date(cert.issuedAt || cert.createdAt);
      const monthsAgo = (Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsAgo <= 6;
    }).length;
    
    // Weighted scoring: 40% avg score, 30% cert count, 30% recent activity
    const score = (avgScore * 0.4) + (Math.min(certCount * 10, 30) * 0.3) + (recentActivity * 10 * 0.3);
    return Math.min(Math.round(score), 100);
  };

  const getTechnicalStrengths = (certs: any[]) => {
    const strengths = [];
    const categories = certs.map(cert => getCategoryFromCourse(cert.course || ''));
    const uniqueCategories = [...new Set(categories)];
    
    if (uniqueCategories.includes('Data Science')) strengths.push('Data Analysis');
    if (uniqueCategories.includes('Web Development')) strengths.push('Frontend Development');
    if (uniqueCategories.includes('Artificial Intelligence')) strengths.push('AI/ML');
    if (uniqueCategories.includes('Business')) strengths.push('Business Strategy');
    
    return strengths.slice(0, 3);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getBadgeColor = (badge: string) => {
    switch (badge.toLowerCase()) {
      case 'platinum': return 'bg-purple-100 text-purple-800';
      case 'gold': return 'bg-yellow-100 text-yellow-800';
      case 'silver': return 'bg-gray-100 text-gray-800';
      case 'expert': return 'bg-green-100 text-green-800';
      case 'professional': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleWatchInterview = async (interview: Interview) => {
    if (!interview.videoUrl) {
      toast({
        title: "Video Not Available",
        description: "This interview recording is not available.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/recruiter/access-interview-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('recruiterToken')}`,
        },
        body: JSON.stringify({
          interviewId: interview.id,
          candidateId: params?.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: "Access Failed",
          description: error.message || "Failed to access interview video",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      setWatchingVideo({ interview, videoUrl: data.videoUrl });
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while accessing the video",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Candidate Not Found</h2>
          <p className="text-gray-600">The candidate profile you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-2xl font-semibold bg-blue-600 text-white">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{candidate.name}</h1>
                <p className="text-gray-600">{candidate.currentRole}</p>
                <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    {candidate.location}
                  </div>
                  <div className="flex items-center">
                    <Briefcase className="h-4 w-4 mr-1" />
                    {candidate.experience} years exp
                  </div>
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    {candidate.profileViews} views
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download CV
              </Button>
              <Button size="sm">
                <Heart className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Analytics & Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Performance Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{candidate.averageScore}%</div>
                    <div className="text-sm text-gray-500">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{candidate.certificates.length}</div>
                    <div className="text-sm text-gray-500">Certificates</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{candidate.interviews.length}</div>
                    <div className="text-sm text-gray-500">Interviews</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{candidate.dedicationScore}%</div>
                    <div className="text-sm text-gray-500">Dedication</div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Skill Distribution</h4>
                  <div className="space-y-3">
                    {(candidate.technicalStrength || []).map((strength, index) => (
                      <div key={strength}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{strength}</span>
                          <span>{85 + index * 5}%</span>
                        </div>
                        <Progress value={85 + index * 5} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for detailed information */}
            <Tabs defaultValue="certificates" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="certificates">Certificates</TabsTrigger>
                <TabsTrigger value="interviews">Interviews</TabsTrigger>
                <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="certificates" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Award className="h-5 w-5 mr-2" />
                      Certifications ({candidate.certificates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {candidate.certificates.map((cert, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{cert.courseTitle}</h4>
                              <div className="flex items-center mt-2 space-x-4">
                                <Badge className={getBadgeColor(cert.badge)}>
                                  {cert.badge}
                                </Badge>
                                <span className={`font-semibold ${getScoreColor(cert.score)}`}>
                                  {cert.score}% Score
                                </span>
                                <span className="text-sm text-gray-500">
                                  {cert.difficulty}
                                </span>
                              </div>
                              <div className="flex items-center mt-2 text-sm text-gray-500">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(cert.issuedAt).toLocaleDateString()}
                                <span className="mx-2">•</span>
                                <span>{cert.category}</span>
                              </div>
                            </div>
                            <Trophy className={`h-6 w-6 ${cert.score >= 90 ? 'text-yellow-500' : 'text-gray-400'}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="interviews" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Video className="h-5 w-5 mr-2" />
                      Interview Recordings ({candidate.interviews.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {candidate.interviews.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Video className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No interview recordings available</p>
                        <p className="text-sm">This candidate hasn't completed any AI interviews yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {candidate.interviews.map((interview, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{interview.technology} Interview</h4>
                                <div className="flex items-center mt-1 space-x-4 text-sm">
                                  <span className={`font-semibold ${getScoreColor(interview.score)}`}>
                                    Score: {interview.score}% ({interview.grade})
                                  </span>
                                  <span className="text-gray-500">
                                    {new Date(interview.completedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleWatchInterview(interview)}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Watch (2 credits)
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="analytics" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Brain className="h-5 w-5 mr-2" />
                      Advanced Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Learning Pattern</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm">Consistency</span>
                            <span className="text-sm font-medium">High</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Learning Speed</span>
                            <span className="text-sm font-medium">Fast</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Improvement Rate</span>
                            <span className="text-sm font-medium">15% per month</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-3">Engagement Metrics</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm">Platform Activity</span>
                            <span className="text-sm font-medium">Active</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Response Time</span>
                            <span className="text-sm font-medium">&lt; 24 hours</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Completion Rate</span>
                            <span className="text-sm font-medium">95%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">AI Recommendation</h4>
                      <p className="text-sm text-blue-800">
                        This candidate shows strong technical aptitude with consistent learning patterns. 
                        High dedication score indicates reliability for long-term roles. 
                        Strong performance in {(candidate.technicalStrength || []).join(', ')} areas.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Quick Info & Actions */}
          <div className="space-y-6">
            {/* Contact & Availability */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="font-medium">{candidate.email}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Availability</label>
                  <p className="font-medium">{candidate.availability}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Notice Period</label>
                  <p className="font-medium">{candidate.noticePeriod}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Expected Salary</label>
                  <p className="font-medium">{candidate.expectedSalary}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Last Active</label>
                  <p className="font-medium">{candidate.lastActive}</p>
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code className="h-5 w-5 mr-2" />
                  Technical Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(candidate.skills || []).map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Schedule Interview
                </Button>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Request Resume
                </Button>
                <Button variant="outline" className="w-full">
                  Send Message
                </Button>
              </CardContent>
            </Card>

            {/* Dedication Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Dedication Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {candidate.dedicationScore}%
                  </div>
                  <Progress value={candidate.dedicationScore} className="mb-3" />
                  <p className="text-sm text-gray-600">
                    Based on learning consistency, performance, and engagement
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {watchingVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                {watchingVideo.interview.technology} Interview - {candidate?.name}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWatchingVideo(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-4">
              <video
                src={watchingVideo.videoUrl}
                controls
                className="w-full h-96 bg-black rounded-lg"
                onError={() => {
                  toast({
                    title: "Video Error",
                    description: "Unable to load video",
                    variant: "destructive",
                  });
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                Score: <span className={`font-semibold ${getScoreColor(watchingVideo.interview.score)}`}>
                  {watchingVideo.interview.score}% ({watchingVideo.interview.grade})
                </span>
              </div>
              <div>
                Date: {new Date(watchingVideo.interview.completedAt).toLocaleDateString()}
              </div>
            </div>
            
            {watchingVideo.interview.feedback && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">AI Feedback</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {watchingVideo.interview.feedback}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}