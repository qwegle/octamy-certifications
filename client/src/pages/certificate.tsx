import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Download, Printer, Share2, CheckCircle, XCircle, Loader2, Shield, Award, Calendar, User, Globe } from 'lucide-react';
import type { Certificate } from '@shared/schema';
import octamyLogo from '@/assets/image_1750054456482.png';
import { useState } from 'react';

export default function CertificateView() {
  const { certificateId } = useParams();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: certificate } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  const handleDownload = async () => {
    if (!certificate?.isPaid) {
      alert('Certificate payment is required before download');
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/certificates/${certificateId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Certificate-${certificate.userName}-${certificate.courseTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download certificate. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Failed to download certificate. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const iframe = document.getElementById('certificateIframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
      } else {
        // Fallback: open in new window for printing
        window.open(`/api/certificates/${certificateId}/download`, '_blank');
      }
    } catch (error) {
      console.error('Error printing certificate:', error);
      window.open(`/api/certificates/${certificateId}/download`, '_blank');
    } finally {
      setTimeout(() => setIsPrinting(false), 1000);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/certificate/${certificate?.certificateId}`;
    const shareText = `🎓 Professional Certificate Achievement\n\nI've successfully completed the ${certificate?.courseTitle} certification program through Octamy Solutions Private Limited.\n\nScore: ${certificate?.score}%\nCertificate ID: ${certificate?.certificateNumber}\n\nVerify this certificate at:`;
    
    if (navigator.share) {
      navigator.share({
        title: `Professional Certificate - ${certificate?.userName}`,
        text: shareText,
        url: shareUrl
      }).catch(() => {
        // Fallback to clipboard
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('Certificate link copied to clipboard!');
      });
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      alert('Certificate link copied to clipboard!');
    }
  };

  if (!certificate) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="shadow-lg">
            <CardContent className="text-center py-16">
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Certificate Not Found</h2>
              <p className="text-gray-600 text-lg">
                The certificate you're looking for doesn't exist or has been removed.
              </p>
              <p className="text-sm text-gray-500 mt-4">
                Please verify the certificate ID and try again.
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <img src={octamyLogo} alt="Octamy Solutions" className="h-12 w-auto" />
              <div className="text-left">
                <h1 className="text-3xl font-bold">OCTAMY SOLUTIONS</h1>
                <p className="text-sm text-gray-300">Private Limited - ISO Certified</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-3 mb-4">
              {isActive ? (
                <Badge className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-base">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Verified & Authentic Certificate
                </Badge>
              ) : (
                <Badge variant="destructive" className="px-4 py-2 text-base">
                  <XCircle className="w-5 h-5 mr-2" />
                  {!certificate.isPaid ? 'Payment Required' : isExpired ? 'Certificate Expired' : 'Invalid Certificate'}
                </Badge>
              )}
            </div>
            
            <h2 className="text-2xl font-semibold text-gray-200 mb-2">Professional Certification Document</h2>
            <p className="text-gray-400">Digitally signed and verified by authorized certification body</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Certificate Display */}
          <div className="lg:col-span-3">
            <Card className="shadow-xl border-2 border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Certificate Document</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Shield className="w-4 h-4" />
                    <span>Blockchain Verified</span>
                  </div>
                </div>
                
                {/* Certificate iframe */}
                <div className="relative">
                  {!isActive && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 rounded-lg">
                      <div className="text-center text-white">
                        <XCircle className="w-16 h-16 mx-auto mb-4" />
                        <h4 className="text-xl font-bold mb-2">
                          {!certificate.isPaid ? 'Payment Required' : isExpired ? 'Certificate Expired' : 'Certificate Invalid'}
                        </h4>
                        <p className="text-gray-300">
                          {!certificate.isPaid 
                            ? 'Complete payment to access this certificate' 
                            : isExpired 
                            ? 'This certificate has expired and is no longer valid'
                            : 'This certificate is not currently valid'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-white border-4 border-gray-300 rounded-lg overflow-hidden shadow-inner" 
                       style={{ aspectRatio: '1.414/1' }}>
                    <iframe
                      id="certificateIframe"
                      src={`/api/certificates/${certificateId}/download`}
                      className="w-full h-full border-0"
                      title="Professional Certificate"
                      style={{ minHeight: '600px' }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center gap-4 mt-8 pt-6 border-t border-gray-200">
                  <Button
                    onClick={handleDownload}
                    disabled={isDownloading || !isActive}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold min-w-40"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 mr-2" />
                        Download PDF
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                    disabled={isPrinting || !isActive}
                    className="border-2 border-gray-600 text-gray-700 hover:bg-gray-50 px-8 py-3 text-lg font-semibold min-w-40"
                  >
                    {isPrinting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Printing...
                      </>
                    ) : (
                      <>
                        <Printer className="w-5 h-5 mr-2" />
                        Print Certificate
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="border-2 border-green-600 text-green-700 hover:bg-green-50 px-8 py-3 text-lg font-semibold min-w-40"
                  >
                    <Share2 className="w-5 h-5 mr-2" />
                    Share Certificate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Certificate Information Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Certificate Details */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-blue-600" />
                  Certificate Details
                </h4>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 block">Recipient</span>
                    <span className="text-gray-900">{certificate.userName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 block">Email Address</span>
                    <span className="text-gray-900 break-all">{certificate.userEmail}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 block">Course Title</span>
                    <span className="text-gray-900">{certificate.courseTitle}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 block">Achievement Score</span>
                    <span className="text-blue-600 font-bold text-lg">{certificate.score}%</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 block">Certificate ID</span>
                    <span className="font-mono text-gray-900 text-xs">{certificate.certificateNumber}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verification Info */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-green-600" />
                  Verification
                </h4>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 block">Issue Date</span>
                    <span className="text-gray-900">{new Date(certificate.issuedAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 block">Valid Until</span>
                    <span className="text-gray-900">{(() => {
                      const expiry = new Date(certificate.issuedAt);
                      expiry.setFullYear(expiry.getFullYear() + 3);
                      return expiry.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      });
                    })()}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 block">Status</span>
                    <span className={`font-semibold ${
                      isActive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isActive ? 'Active & Valid' : 
                       !certificate.isPaid ? 'Pending Payment' : 
                       isExpired ? 'Expired' : 'Invalid'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 block">Certification Body</span>
                    <span className="text-gray-900">Octamy Solutions Private Limited</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Authenticity Verification */}
            <Card className="shadow-lg bg-gradient-to-br from-green-50 to-blue-50">
              <CardContent className="p-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Authenticity
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">ISO Certified Issuer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">Blockchain Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">Digitally Signed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-gray-700">Globally Recognized</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-green-200">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    This certificate can be independently verified through our blockchain-based verification system. 
                    The authenticity is guaranteed by cryptographic signatures and immutable records.
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}