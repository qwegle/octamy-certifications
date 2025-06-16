import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { QrCode, Download, Share2, Trophy, Calendar, Award, CheckCircle, XCircle } from 'lucide-react';
import type { Certificate } from '@shared/schema';

export default function CertificateView() {
  const { certificateId } = useParams();

  const { data: certificate } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `Check out my ${certificate?.courseTitle} certification from Octamy!`;
    
    let shareUrl = '';
    switch (platform) {
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  if (!certificate) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="text-center py-12">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-octamy-black mb-2">Certificate Not Found</h2>
              <p className="text-octamy-gray-600">
                The certificate you're looking for doesn't exist or has been removed.
              </p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const isExpired = new Date(certificate.expiresAt) < new Date();
  const isActive = certificate.isActive && certificate.isPaid && !isExpired;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            {isActive ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-4 h-4 mr-1" />
                Verified Certificate
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="w-4 h-4 mr-1" />
                {!certificate.isPaid ? 'Unpaid' : isExpired ? 'Expired' : 'Invalid'}
              </Badge>
            )}
          </div>
          <h1 className="text-4xl font-bold text-octamy-black mb-4">
            Professional Certificate
          </h1>
          <p className="text-xl text-octamy-gray-600">
            Issued by Octamy Certification Platform
          </p>
        </div>

        {/* Certificate Display */}
        <Card className="mb-8 relative overflow-hidden">
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-10">
              <div className="text-6xl font-bold text-red-400 transform rotate-45">
                {!certificate.isPaid ? 'UNPAID' : isExpired ? 'EXPIRED' : 'INVALID'}
              </div>
            </div>
          )}
          
          <CardContent className="p-8 relative z-20">
            {/* Certificate Header */}
            <div className="text-center mb-8">
              <span className="text-2xl font-bold text-octamy-black mb-4 block">octamy</span>
              <h3 className="text-3xl font-bold text-octamy-black">Certificate of Completion</h3>
            </div>

            {/* Certificate Body */}
            <div className="text-center mb-8">
              <p className="text-lg text-octamy-gray-600 mb-4">This certifies that</p>
              <h4 className="text-4xl font-bold text-octamy-black mb-4">{certificate.userName}</h4>
              <p className="text-lg text-octamy-gray-600 mb-2">has successfully completed</p>
              <h5 className="text-2xl font-semibold text-octamy-black mb-6">{certificate.courseTitle}</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-8">
                <div className="flex flex-col items-center">
                  <Trophy className="w-8 h-8 text-octamy-black mb-2" />
                  <p className="text-sm text-octamy-gray-500">Score</p>
                  <p className="text-xl font-bold text-octamy-black">{certificate.score}%</p>
                  {certificate.mastered && (
                    <Badge className="mt-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                      <Award className="w-3 h-3 mr-1" />
                      Mastery Achieved
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <Calendar className="w-8 h-8 text-octamy-black mb-2" />
                  <p className="text-sm text-octamy-gray-500">Date Issued</p>
                  <p className="text-xl font-bold text-octamy-black">
                    {new Date(certificate.issuedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <Award className="w-8 h-8 text-octamy-black mb-2" />
                  <p className="text-sm text-octamy-gray-500">Valid Until</p>
                  <p className="text-xl font-bold text-octamy-black">
                    {new Date(certificate.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Certificate Footer */}
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-octamy-gray-200">
              <div className="text-center mb-4 md:mb-0">
                <p className="text-sm text-octamy-gray-500">Certificate ID</p>
                <p className="font-mono text-octamy-black">{certificate.certificateId}</p>
              </div>
              <div className="w-16 h-16 bg-octamy-gray-200 rounded flex items-center justify-center">
                <QrCode className="w-8 h-8 text-octamy-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificate Details */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-octamy-black mb-4">Certificate Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-octamy-gray-700">Recipient:</span>
                <span className="ml-2">{certificate.userName}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Email:</span>
                <span className="ml-2">{certificate.userEmail}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Course:</span>
                <span className="ml-2">{certificate.courseTitle}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Score:</span>
                <span className="ml-2">{certificate.score}%</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Issue Date:</span>
                <span className="ml-2">{new Date(certificate.issuedAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Expiry Date:</span>
                <span className="ml-2">{new Date(certificate.expiresAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Status:</span>
                <span className={`ml-2 ${isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {isActive ? 'Valid' : (!certificate.isPaid ? 'Unpaid' : isExpired ? 'Expired' : 'Invalid')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share Section */}
        {isActive && (
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-bold text-octamy-black mb-4">Share This Certificate</h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare('linkedin')}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Share on LinkedIn
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare('twitter')}
                  className="text-blue-400 border-blue-400 hover:bg-blue-50"
                >
                  Share on Twitter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare('whatsapp')}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  Share on WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />
    </div>
  );
}
