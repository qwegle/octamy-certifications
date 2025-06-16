import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Download, Eye, Calendar, Trophy, Award, AlertCircle } from 'lucide-react';
import type { Certificate } from '@shared/schema';
import { SmartNotifications } from '@/components/smart-notifications';

export default function Dashboard() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

  const { data: certificates = [] } = useQuery<Certificate[]>({
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

  const activeCertificates = certificates.filter(cert => 
    cert.isActive && cert.isPaid && new Date(cert.expiresAt) > new Date()
  );
  const expiredCertificates = certificates.filter(cert => 
    cert.isActive && cert.isPaid && new Date(cert.expiresAt) <= new Date()
  );
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
            <div className="flex items-center gap-4">
              <SmartNotifications />
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
                        onClick={() => window.open(`/certificates/${certificate.certificateId}`, '_blank')}
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
                      <Link href={`/payment/${certificate.id}`}>
                        <Button
                          size="sm"
                          className="w-full bg-octamy-black text-white hover:bg-octamy-gray-800"
                        >
                          Pay ₹199 & Download
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

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
