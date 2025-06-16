import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/header';
import PayUMoneyForm from '@/components/payumoney-form';
import { QrCode, Download, Share2, Trophy, Calendar, Award } from 'lucide-react';
import type { Certificate } from '@shared/schema';

export default function Payment() {
  const { certificateId } = useParams();
  const [, setLocation] = useLocation();

  const { data: certificate, refetch } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  const handlePaymentSuccess = async () => {
    await refetch();
    setLocation('/dashboard');
  };

  if (!certificate) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading certificate...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!certificate.isPaid ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Certificate Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certificate Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg text-center">
                  <div className="text-2xl font-bold mb-2">{certificate.courseTitle}</div>
                  <div className="text-lg mb-4">Certificate of Achievement</div>
                  <div className="text-sm text-gray-600 mb-4">
                    This is to certify that
                  </div>
                  <div className="text-xl font-semibold mb-4">{certificate.userName}</div>
                  <div className="text-sm text-gray-600 mb-4">
                    has successfully completed the course with a score of
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    {certificate.score}% - {certificate.badge}
                  </Badge>
                  <div className="text-xs text-gray-500 mt-4">
                    Certificate ID: {certificate.certificateId}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Score:</span>
                    <span className="font-medium">{certificate.score}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Badge:</span>
                    <Badge variant="outline">{certificate.badge}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Valid Until:</span>
                    <span className="font-medium">
                      {new Date(certificate.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            <PayUMoneyForm
              certificateId={certificateId!}
              courseId={certificate.courseId || 67}
              amount="99"
              userEmail={certificate.userEmail}
              userName={certificate.userName}
              courseTitle={certificate.courseTitle}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-green-600">
                <Award className="h-8 w-8 mx-auto mb-2" />
                Payment Successful!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-lg">
                Your certificate is now ready for download.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  className="bg-octamy-black text-white hover:bg-octamy-gray-800"
                  onClick={() => window.open(`/api/certificates/${certificate.certificateId}/download`, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Certificate
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'My Certificate',
                        text: `I've earned a certificate in ${certificate.courseTitle}!`,
                        url: `${window.location.origin}/verify/${certificate.certificateId}`
                      });
                    } else {
                      navigator.clipboard.writeText(`${window.location.origin}/verify/${certificate.certificateId}`);
                      // Add toast notification for copy
                    }
                  }}
                  className="border-octamy-gray-300 text-octamy-black hover:bg-octamy-gray-50"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Certificate
                </Button>
              </div>

              <div className="bg-octamy-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <QrCode className="h-4 w-4" />
                  <span className="text-sm font-medium">Verification</span>
                </div>
                <p className="text-xs text-octamy-gray-600">
                  Certificate ID: {certificate.certificateId}
                </p>
                <p className="text-xs text-octamy-gray-600">
                  Verify at: octamy.com/verify
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}