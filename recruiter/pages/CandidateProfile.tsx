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
import RecruiterLayout from '../components/RecruiterLayout';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { downloadCandidateCv } from '../utils/downloadCandidateCv';
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
  score?: number;
  grade?: string;
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
  profileCompleteness?: number;
  averageScore: number;
  dedicationScore: number;
  technicalStrength: string[];
  careerGoals?: string;
  availability?: string;
  noticePeriod?: string;
  expectedSalary?: string;
  hasResume: boolean;
  cvAccessUnlocked: boolean;
  interviewAccessUnlocked: boolean;
  creditCosts: { profile_view: number; cv_download: number; interview_access: number };
}

export default function CandidateProfile() {
  const [, params] = useRoute('/recruiter/profile/:id');
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchingVideo, setWatchingVideo] = useState<{interview: Interview, videoUrl: string} | null>(null);
  const [unlockingInterviews, setUnlockingInterviews] = useState(false);
  const { toast } = useToast();
  const { updateRecruiter } = useRecruiterAuth();

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
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `Failed to fetch candidate profile: ${response.status}`);
      }
      
      const profileData = await response.json();
      const certs = Array.isArray(profileData.certificates) ? profileData.certificates : [];
      setCandidate({
        ...profileData,
        location: profileData.location || 'Location not provided',
        currentRole: profileData.currentRole || 'Role not provided',
        experience: Number(profileData.experience || 0),
        skills: Array.isArray(profileData.skills) ? profileData.skills : [],
        interviews: Array.isArray(profileData.interviews) ? profileData.interviews : [],
        certificates: certs,
        averageScore: calculateAverageScore(certs),
        dedicationScore: Number(profileData.profileCompleteness || 0),
        technicalStrength: getTechnicalStrengths(certs),
      });
    } catch (error) {
      console.error('Error fetching candidate profile:', error);
      toast({
        title: 'Profile unavailable',
        description: error instanceof Error ? error.message : 'Failed to load candidate profile',
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
      const course = (cert.courseTitle || cert.course || '').toLowerCase();
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
    const categories = certs.map(cert => getCategoryFromCourse(cert.courseTitle || cert.course || ''));
    const uniqueCategories = Array.from(new Set(categories));
    
    if (uniqueCategories.includes('Data Science')) strengths.push('Data Analysis');
    if (uniqueCategories.includes('Web Development')) strengths.push('Frontend Development');
    if (uniqueCategories.includes('Artificial Intelligence')) strengths.push('AI/ML');
    if (uniqueCategories.includes('Business')) strengths.push('Business Strategy');
    
    return strengths.slice(0, 3);
  };

  const getScoreColor = (score = 0) => {
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
    setUnlockingInterviews(true);
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
          title: "Interview access unchanged",
          description: error.message || "Failed to access interview video",
        });
        return;
      }

      const data = await response.json();
      updateRecruiter({ creditsBalance: data.creditsRemaining });
      setWatchingVideo({ interview, videoUrl: data.videoUrl });
      if (!data.alreadyUnlocked) {
        toast({ title: 'Interview evidence unlocked', description: data.message });
        await fetchCandidateProfile(String(candidate?.id || candidateId));
      }
    } catch (error) {
      toast({
        title: "Interview unavailable",
        description: "An error occurred while accessing the video",
      });
    } finally {
      setUnlockingInterviews(false);
    }
  };

  const handleDownloadCv = async () => {
    if (!candidate) return;
    try {
      const response = await apiRequest('POST', '/api/recruiter/access-profile', { candidateId: candidate.id, accessType: 'cv' });
      const data = await response.json();
      if (!data.cvUrl) throw new Error('Candidate CV is not available');
      updateRecruiter({ creditsBalance: data.remainingCredits });
      await downloadCandidateCv(data.cvUrl, candidate.id);
    } catch (error) {
      toast({ title: 'CV unavailable', description: error instanceof Error ? error.message : 'Could not download this CV' });
    }
  };

  if (loading) {
    return (
      <RecruiterLayout><div className="flex min-h-64 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div></RecruiterLayout>
    );
  }

  if (!candidate) {
    return (
      <RecruiterLayout><div className="flex min-h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Candidate Not Found</h2>
          <p className="text-gray-600">The candidate profile you're looking for doesn't exist.</p>
        </div>
      </div></RecruiterLayout>
    );
  }

  return (
    <RecruiterLayout><div>
      {/* Header */}
      <div className="bg-cream-soft border-b border-cream-deep">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-2xl font-semibold bg-blue-600 text-white">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{candidate.name}</h1>
                <p className="text-gray-600">{candidate.currentRole}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
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
            <div>
              <Button variant="outline" size="sm" onClick={handleDownloadCv} disabled={!candidate.hasResume}>
                <Download className="h-4 w-4 mr-2" />
                {!candidate.hasResume
                  ? 'CV not shared'
                  : candidate.cvAccessUnlocked
                    ? 'Download CV · unlocked'
                    : `Unlock CV · ${candidate.creditCosts.cv_download} credit`}
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
                    <div className="text-sm text-gray-500">Profile complete</div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Evidence areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {(candidate.technicalStrength || []).length > 0
                      ? candidate.technicalStrength.map((strength) => <Badge key={strength} variant="secondary">{strength}</Badge>)
                      : <span className="text-sm text-gray-500">No category-level evidence available yet.</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for detailed information */}
            <Tabs defaultValue="certificates" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="certificates">Certificates</TabsTrigger>
                <TabsTrigger value="interviews">Interviews</TabsTrigger>
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
                        {!candidate.interviewAccessUnlocked ? (
                          <div className="flex flex-col gap-4 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold text-sky-950">Interview scores and recordings are protected</p>
                              <p className="mt-1 text-sm text-sky-800">One unlock covers this candidate's available interview evidence in your workspace. Reopening costs 0 credits.</p>
                            </div>
                            <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-sky-900 shadow-sm">{candidate.creditCosts.interview_access} credits</span>
                          </div>
                        ) : null}
                        {candidate.interviews.map((interview, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{interview.technology} Interview</h4>
                                <div className="flex items-center mt-1 space-x-4 text-sm">
                                  {candidate.interviewAccessUnlocked ? (
                                    <span className={`font-semibold ${getScoreColor(interview.score)}`}>
                                      Score: {interview.score}% ({interview.grade || 'No grade'})
                                    </span>
                                  ) : (
                                    <span className="font-medium text-slate-500">Score hidden until unlocked</span>
                                  )}
                                  <span className="text-gray-500">
                                    {interview.completedAt ? new Date(interview.completedAt).toLocaleDateString() : 'Date unavailable'}
                                  </span>
                                </div>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleWatchInterview(interview)}
                                disabled={unlockingInterviews}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                {candidate.interviewAccessUnlocked ? 'Watch · unlocked' : `Unlock & watch · ${candidate.creditCosts.interview_access}`}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                  <p className="font-medium">{candidate.lastActive ? new Date(candidate.lastActive).toLocaleString() : 'Not available'}</p>
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
                <Button className="w-full" onClick={handleDownloadCv} disabled={!candidate.hasResume}>
                  <Download className="h-4 w-4 mr-2" />
                  {!candidate.hasResume
                    ? 'CV not shared'
                    : candidate.cvAccessUnlocked
                      ? 'Download CV · unlocked'
                      : `Unlock CV · ${candidate.creditCosts.cv_download} credit`}
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <a href={`mailto:${candidate.email}?subject=${encodeURIComponent('Opportunity from Octamy Recruiter')}`}>
                    Contact candidate
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Profile completeness */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Profile completeness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {candidate.dedicationScore}%
                  </div>
                  <Progress value={candidate.dedicationScore} className="mb-3" />
                  <p className="text-sm text-gray-600">
                    Based on candidate-provided profile fields.
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
          <div className="bg-cream-soft rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
                    title: "Video unavailable",
                    description: "The recording could not be loaded. No additional credits were charged.",
                  });
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                {watchingVideo.interview.score == null ? 'Interview evidence unlocked' : <>Score: <span className={`font-semibold ${getScoreColor(watchingVideo.interview.score)}`}>
                  {watchingVideo.interview.score}% ({watchingVideo.interview.grade || 'No grade'})
                </span></>}
              </div>
              <div>
                Date: {watchingVideo.interview.completedAt ? new Date(watchingVideo.interview.completedAt).toLocaleDateString() : 'Not available'}
              </div>
            </div>
            
            {watchingVideo.interview.feedback && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">AI Feedback</h4>
                <p className="text-sm text-gray-600 bg-cream-deep p-3 rounded-lg">
                  {watchingVideo.interview.feedback}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div></RecruiterLayout>
  );
}
