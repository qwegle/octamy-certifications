import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Download, Eye, Calendar, Trophy, Award, AlertCircle, Brain, TrendingUp } from 'lucide-react';
import type { Certificate } from '@shared/schema';
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
              <h1 className="text-4xl font-bold text-octamy-black mb-2">
                Welcome back, {user.name}!
              </h1>
              <p className="text-xl text-octamy-gray-600">
                Manage your certificates and track your progress
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Award className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-octamy-black">{activeCertificates.length}</div>
              <div className="text-sm text-octamy-gray-600">Active Certificates</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-octamy-black">{expiredCertificates.length}</div>
              <div className="text-sm text-octamy-gray-600">Expired Certificates</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-octamy-black">{unpaidCertificates.length}</div>
              <div className="text-sm text-octamy-gray-600">Unpaid Certificates</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-octamy-black">{certificates.length}</div>
              <div className="text-sm text-octamy-gray-600">Total Attempts</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <Award className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-octamy-black">{certificates.filter(c => c.mastered).length}</div>
              <div className="text-sm text-octamy-gray-600">Mastery Achieved</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Certificates */}
        {activeCertificates.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-octamy-black mb-4">Active Certificates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCertificates.map((certificate) => (
                <Card key={certificate.id} className="border-green-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-green-100 text-green-800">Valid</Badge>
                      <Trophy className="w-5 h-5 text-green-600" />
                    </div>
                    <CardTitle className="text-lg">{certificate.courseTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-octamy-gray-600">Score:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{certificate.score}%</span>
                        {certificate.mastered && (
                          <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                            Master
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-octamy-gray-600">Expires:</span>
                      <span className="font-semibold">
                        {new Date(certificate.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/certificate/${certificate.certificateId}`, '_blank')}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(certificate.certificateId)}
                        className="flex-1 bg-octamy-black text-white hover:bg-octamy-gray-800"
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
                        className="border-octamy-gray-300 text-octamy-gray-700 hover:bg-octamy-gray-200"
                      >
                        🔗 Share
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Expired Certificates */}
        {expiredCertificates.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-octamy-black mb-4">Expired Certificates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {expiredCertificates.map((certificate) => (
                <Card key={certificate.id} className="border-orange-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="destructive">Expired</Badge>
                      <Calendar className="w-5 h-5 text-orange-600" />
                    </div>
                    <CardTitle className="text-lg">{certificate.courseTitle}</CardTitle>
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
                      <span className="text-octamy-gray-600">Score:</span>
                      <span className="font-semibold">{certificate.score}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-octamy-gray-600">Date:</span>
                      <span className="font-semibold">
                        {new Date(certificate.issuedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="pt-2">
                      <Link href={`/checkout?certificateId=${certificate.certificateId}&courseId=${certificate.courseId}`}>
                        <Button
                          size="sm"
                          className="w-full bg-octamy-black text-white hover:bg-octamy-gray-800"
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

        {/* Dashboard Analytics */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-octamy-black mb-6">Learning Analytics</h2>
          <DashboardAnalytics />
        </div>

        {/* AI Interviews Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-octamy-black">AI Interviews</h2>
            <Link href="/ai-interviews">
              <Button className="bg-octamy-black text-white hover:bg-octamy-gray-800">
                <Brain className="w-4 h-4 mr-2" />
                Start Interview
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-6 text-center">
              <Brain className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Practice Technical Interviews</h3>
              <p className="text-gray-600 mb-4">
                Take AI-powered technical interviews with real-time feedback and analysis
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">5-7</div>
                  <div className="text-sm text-gray-500">Questions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">45-60</div>
                  <div className="text-sm text-gray-500">Minutes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">₹99</div>
                  <div className="text-sm text-gray-500">Per Interview</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        {certificates.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Award className="w-16 h-16 text-octamy-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-octamy-black mb-2">No Certificates Yet</h2>
              <p className="text-octamy-gray-600 mb-6">
                You haven't taken any certification exams yet. Start your journey today!
              </p>
              <Link href="/">
                <Button className="bg-octamy-black text-white hover:bg-octamy-gray-800">
                  Browse Courses
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />
    </div>
  );
}
