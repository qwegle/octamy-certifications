import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Download, Eye, Calendar, Trophy, Award, AlertCircle, Brain, TrendingUp, DollarSign, Play, ArrowRight, Edit, History } from 'lucide-react';
import type { Certificate, Interview } from '@shared/schema';
import DashboardAnalytics from '@/components/dashboard-analytics';


export default function Dashboard() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

  const { data: certificates = [], isLoading: certificatesLoading, error: certificatesError } = useQuery<Certificate[]>({
    queryKey: ['/api/user/certificates'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const response = await fetch('/api/user/certificates', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch certificates');
      return response.json();
    },
  });

  // Fetch user's interviews
  const { data: userInterviews = [] } = useQuery<Interview[]>({
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

  // Debug logging for certificate data
  console.log('Dashboard certificates data:', { certificates, certificatesLoading, certificatesError });

  // Show debug info if certificates are loading or failed
  if (certificatesLoading) {
    console.log('Loading certificates...');
  }
  
  if (certificatesError) {
    console.error('Certificate loading error:', certificatesError);
  }

  const handleDownload = async (certificateId: string) => {
    try {
      // Open certificate in new tab for printing/saving as PDF
      const downloadUrl = `/api/certificates/${certificateId}/download`;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download certificate. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-octamy-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-octamy-black mb-2">Login Required</h2>
              <p className="text-octamy-gray-600 mb-6">
                Please log in to view your certificate dashboard.
              </p>
              <Link href="/auth">
                <Button className="bg-octamy-black text-white hover:bg-octamy-gray-800">
                  Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // CERTIFICATE DISPLAY LOGIC FOR DEVELOPERS:
  // Dashboard shows certificates in three categories based on status and payment
  
  // 1. Active Certificates: Paid certificates that haven't expired yet
  // These are the user's valid, downloadable certificates
  const activeCertificates = certificates.filter(cert => 
    cert.isActive && cert.isPaid && new Date(cert.expiresAt) > new Date()
  );
  
  // 2. Expired Certificates: Paid certificates that have passed their expiry date
  // These were valid certificates but are no longer current
  const expiredCertificates = certificates.filter(cert => 
    cert.isActive && cert.isPaid && new Date(cert.expiresAt) <= new Date()
  );
  
  // 3. Unpaid Certificates: Certificates created after passing exams but not yet purchased
  // Users need to complete payment to activate these certificates
  const unpaidCertificates = certificates.filter(cert => !cert.isPaid);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-black mb-2">
                Welcome back, {user.name}!
              </h1>
              <p className="text-xl text-gray-600">
                Manage your certificates and track your progress
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/profile-edit">
                <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Key Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <Award className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">{certificates.length}</div>
              <div className="text-sm text-gray-600 font-medium">Total Certificates</div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <Brain className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">{userInterviews.length}</div>
              <div className="text-sm text-gray-600 font-medium">AI Interviews Taken</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <DollarSign className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">₹{moneySaved}</div>
              <div className="text-sm text-gray-600 font-medium">Money Saved</div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardContent className="p-6 text-center bg-gradient-to-br from-gray-50 to-white">
              <TrendingUp className="w-10 h-10 text-black mx-auto mb-3" />
              <div className="text-3xl font-bold text-black">{averageScore}%</div>
              <div className="text-sm text-gray-600 font-medium">Average Score</div>
            </CardContent>
          </Card>
        </div>

        {/* Certificates Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-black mb-6">Your Certificates</h2>
          
          {/* Active Certificates */}
          {activeCertificates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-4">Active Certificates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCertificates.map((certificate) => (
                  <Card key={certificate.id} className="border-2 border-green-500 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-green-100 text-green-800 font-medium">Active</Badge>
                        <Trophy className="w-5 h-5 text-green-600" />
                      </div>
                      <CardTitle className="text-lg text-black">{certificate.courseTitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Score:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-black">{certificate.score}%</span>
                          {certificate.mastered && (
                            <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                              Master
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Expires:</span>
                        <span className="font-semibold text-black">
                          {new Date(certificate.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/certificate/${certificate.certificateId}`, '_blank')}
                          className="flex-1 border-black text-black hover:bg-gray-100"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDownload(certificate.certificateId)}
                          className="flex-1 bg-black text-white hover:bg-gray-800"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/certificate/${certificate.certificateId}`;
                            if (navigator.share) {
                              navigator.share({
                                title: `Professional Certificate - ${certificate.userName}`,
                                text: `Certificate of completion for ${certificate.courseTitle}`,
                                url: shareUrl
                              });
                            } else {
                              navigator.clipboard.writeText(shareUrl);
                              alert('Shareable link copied to clipboard!');
                            }
                          }}
                          className="border-black text-black hover:bg-gray-100"
                        >
                          🔗
                        </Button>
                      </div>
                    </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

          {/* Unpaid Certificates */}
          {unpaidCertificates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-4">Unpaid Certificates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unpaidCertificates.map((certificate) => (
                  <Card key={certificate.id} className="border-2 border-orange-400 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-orange-100 text-orange-800 font-medium">Payment Pending</Badge>
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                      </div>
                      <CardTitle className="text-lg text-black">{certificate.courseTitle}</CardTitle>
                    </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-octamy-gray-600">Score:</span>
                      <span className="font-semibold">{certificate.score}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-octamy-gray-600">Expired:</span>
                      <span className="font-semibold text-red-600">
                        {new Date(certificate.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/certificates/${certificate.certificateId}`, '_blank')}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-octamy-black text-white hover:bg-octamy-gray-800"
                      >
                        Renew - ₹199
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Unpaid Certificates */}
        {unpaidCertificates.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-octamy-black mb-4">Unpaid Certificates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unpaidCertificates.map((certificate) => (
                <Card key={certificate.id} className="border-red-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="destructive">Unpaid</Badge>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <CardTitle className="text-lg">{certificate.courseTitle}</CardTitle>
                  </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Score:</span>
                        <span className="font-semibold text-black">{certificate.score}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-semibold text-black">
                          {new Date(certificate.issuedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="pt-2">
                        <Link href={`/checkout?certificateId=${certificate.certificateId}&courseId=${certificate.courseId}`}>
                          <Button
                            size="sm"
                            className="w-full bg-black text-white hover:bg-gray-800"
                          >
                            Pay ₹99 & Download
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* AI Interviews Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-black">AI Interviews</h2>
            <div className="flex gap-3">
              {recentInterviews.length > 0 && (
                <Link href="/ai-interviews">
                  <Button variant="outline" className="border-black text-black hover:bg-gray-100">
                    <History className="w-4 h-4 mr-2" />
                    View History
                  </Button>
                </Link>
              )}
              <Link href="/ai-interviews">
                <Button className="bg-black text-white hover:bg-gray-800">
                  <Play className="w-4 h-4 mr-2" />
                  Start Interview Now
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Interviews Horizontal Scroll */}
          {recentInterviews.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-4">Recent Interview Results</h3>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {recentInterviews.map((interview) => (
                  <Card key={interview.id} className="flex-shrink-0 w-80 border-2 border-gray-200 hover:border-black transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-black">{interview.technology}</h4>
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          interview.grade?.startsWith('A') ? 'bg-green-100 text-green-800' :
                          interview.grade?.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                          interview.grade?.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          Grade {interview.grade}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-black mb-2">{interview.score}/100</div>
                      <div className="text-sm text-gray-600 mb-3">
                        Completed on {new Date(interview.completedAt!).toLocaleDateString()}
                      </div>
                      <Link href="/ai-interviews">
                        <Button size="sm" variant="outline" className="w-full border-black text-black hover:bg-black hover:text-white">
                          View Details <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="border-2 border-black mb-6">
              <CardContent className="p-8 text-center">
                <Brain className="w-16 h-16 text-black mx-auto mb-4" />
                <h3 className="text-xl font-bold text-black mb-2">Start Your First AI Interview</h3>
                <p className="text-gray-600 mb-6">
                  Get personalized feedback, score analysis, and shareable results for recruiters
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black">5-7</div>
                    <div className="text-sm text-gray-600">Technical Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black">45-60</div>
                    <div className="text-sm text-gray-600">Minutes Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black">₹99</div>
                    <div className="text-sm text-gray-600">Per Session</div>
                  </div>
                </div>
                <Link href="/ai-interviews">
                  <Button className="bg-black text-white hover:bg-gray-800 px-8">
                    <Play className="w-4 h-4 mr-2" />
                    Start Your First Interview
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Empty State */}
        {certificates.length === 0 && (
          <Card className="border-2 border-black">
            <CardContent className="text-center py-12">
              <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-black mb-2">No Certificates Yet</h2>
              <p className="text-gray-600 mb-6">
                You haven't taken any certification exams yet. Start your journey today!
              </p>
              <Link href="/">
                <Button className="bg-black text-white hover:bg-gray-800">
                  Browse Courses
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
