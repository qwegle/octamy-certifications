import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Download, Printer, Share2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Certificate } from '@shared/schema';
import octamyLogo from '@/assets/image_1750054456482.png';
import { useState } from 'react';

export default function CertificateView() {
  const { certificateId } = useParams();
  const [isDownloading, setIsDownloading] = useState(false);

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
        a.download = `certificate-${certificateId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download certificate');
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/certificate/${certificate?.certificateId}`;
    if (navigator.share) {
      navigator.share({
        title: `Professional Certificate - ${certificate?.userName}`,
        text: `Certificate of completion for ${certificate?.courseTitle}`,
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Shareable link copied to clipboard!');
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Certificate Status */}
        <div className="text-center mb-6">
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
        </div>

        {/* Professional Certificate Display */}
        <div className="relative mb-8">
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-20">
              <div className="text-6xl font-bold text-red-400 transform rotate-45">
                {!certificate.isPaid ? 'UNPAID' : isExpired ? 'EXPIRED' : 'INVALID'}
              </div>
            </div>
          )}
          
          {/* Certificate Container - Matching certificateGenerator.ts design */}
          <div className="certificate-container mx-auto bg-white border-8 border-black rounded-2xl relative overflow-hidden shadow-2xl"
               style={{ 
                 width: '100%', 
                 maxWidth: '1000px', 
                 aspectRatio: '1.414/1',
                 background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
               }}>
            
            {/* Certificate Border */}
            <div className="absolute inset-5 border-2 border-gray-400 rounded-lg"
                 style={{
                   background: `
                     radial-gradient(circle at 0% 0%, #c0c0c0 2px, transparent 2px),
                     radial-gradient(circle at 100% 0%, #c0c0c0 2px, transparent 2px),
                     radial-gradient(circle at 0% 100%, #c0c0c0 2px, transparent 2px),
                     radial-gradient(circle at 100% 100%, #c0c0c0 2px, transparent 2px)
                   `,
                   backgroundSize: '40px 40px',
                   backgroundPosition: 'top left, top right, bottom left, bottom right',
                   backgroundRepeat: 'no-repeat'
                 }}>
            </div>

            {/* Decorative Corners */}
            <div className="absolute top-8 left-8 w-24 h-24 bg-gradient-to-br from-gray-400 to-gray-300"
                 style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
            <div className="absolute top-8 right-8 w-24 h-24 bg-gradient-to-bl from-gray-400 to-gray-300"
                 style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }}></div>
            <div className="absolute bottom-8 left-8 w-24 h-24 bg-gradient-to-tr from-gray-400 to-gray-300"
                 style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }}></div>
            <div className="absolute bottom-8 right-8 w-24 h-24 bg-gradient-to-tl from-gray-400 to-gray-300"
                 style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}></div>

            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
              <div className="text-8xl font-bold text-gray-400 transform -rotate-45">OCTAMY</div>
            </div>

            {/* Certificate Content */}
            <div className="relative z-10 p-16 text-center h-full flex flex-col justify-center">
              
              {/* Header */}
              <div className="mb-8">
                <div className="inline-block bg-gradient-to-r from-black via-gray-800 to-black text-white px-8 py-4 mb-4"
                     style={{ clipPath: 'polygon(10% 0%, 90% 0%, 100% 25%, 100% 75%, 90% 100%, 10% 100%, 0% 75%, 0% 25%)' }}>
                  <div className="text-3xl font-bold uppercase tracking-widest">OCTAMY</div>
                </div>
                <div className="text-sm font-medium text-gray-600 tracking-widest uppercase mb-2">
                  Solutions Private Limited
                </div>
                <div className="text-xs text-gray-500 italic">Authorized Certification Body</div>
              </div>

              {/* Title */}
              <div className="mb-10 relative">
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-gray-600 via-gray-300 to-gray-600"></div>
                <h1 className="text-5xl font-semibold text-gray-900 uppercase tracking-widest mb-2">Certificate</h1>
                <div className="text-2xl text-gray-600 italic">of Professional Excellence</div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-28 h-0.5 bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
              </div>

              {/* Content */}
              <div className="mb-8">
                <p className="text-lg text-gray-600 mb-6 italic">This is to certify that</p>
                
                <div className="relative py-4 mb-6">
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
                  <div className="text-3xl font-semibold text-gray-900">{certificate.userName}</div>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
                </div>

                <p className="text-base text-gray-600 mb-6 leading-relaxed">
                  has successfully demonstrated mastery and completed the comprehensive<br />
                  professional certification program
                </p>

                <div className="border-2 border-gray-400 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 p-4 mb-6">
                  <div className="text-xl font-semibold text-gray-900 uppercase tracking-wider">
                    {certificate.courseTitle}
                  </div>
                </div>

                {/* Achievement Badge */}
                <div className="flex justify-center items-center gap-8">
                  <div className="relative">
                    <svg width="120" height="120" viewBox="0 0 120 120" className="text-gray-700">
                      <defs>
                        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#4a4a4a" />
                          <stop offset="50%" stopColor="#2a2a2a" />
                          <stop offset="100%" stopColor="#1a1a1a" />
                        </linearGradient>
                      </defs>
                      <path d="M60 10 L100 30 L100 60 Q100 80 85 95 Q70 105 60 110 Q50 105 35 95 Q20 80 20 60 L20 30 Z" 
                            fill="url(#shieldGrad)" stroke="#fff" strokeWidth="2"/>
                      <circle cx="60" cy="45" r="15" fill="#fff" stroke="#333" strokeWidth="1"/>
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                      {certificate.badge?.toUpperCase() || 'CERTIFIED'}
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-black to-gray-800 text-white px-8 py-4 rounded shadow-lg">
                    <div className="text-xl font-bold">SCORE: {certificate.score}%</div>
                    <div className="text-xs text-gray-300">Achievement Level</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end mt-12 pt-8 border-t-2 border-gray-400 bg-gradient-to-r from-transparent via-gray-50 to-transparent">
                <div className="text-left text-sm text-gray-600 leading-relaxed">
                  <div><strong>Certificate ID:</strong> {certificate.certificateNumber}</div>
                  <div><strong>Date Issued:</strong> {new Date(certificate.issuedAt).toLocaleDateString()}</div>
                  <div><strong>Valid Until:</strong> {(() => {
                    const expiry = new Date(certificate.issuedAt);
                    expiry.setFullYear(expiry.getFullYear() + 3);
                    return expiry.toLocaleDateString();
                  })()}</div>
                </div>
                
                <div className="text-center">
                  <div className="w-48 h-px bg-black mb-2"></div>
                  <div className="text-sm text-gray-600">Digital Signature</div>
                  <div className="text-base font-semibold text-gray-900">Authorized Signatory</div>
                </div>
                
                <div className="flex gap-4 items-center">
                  <img 
                    src={octamyLogo} 
                    alt="Octamy Logo" 
                    className="h-10 w-auto object-contain opacity-80"
                  />
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-white to-green-500 rounded border border-gray-400 flex items-center justify-center">
                    <div className="w-6 h-6 bg-blue-800 rounded-full flex items-center justify-center">
                      <div className="text-xs text-white font-bold">🇮🇳</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-octamy-black text-white hover:bg-octamy-gray-800"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handlePrint}
            className="border-octamy-black text-octamy-black hover:bg-octamy-gray-50"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Certificate
          </Button>
          
          <Button
            variant="outline"
            onClick={handleShare}
            className="border-octamy-gray-300 text-octamy-gray-700 hover:bg-octamy-gray-200"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Certificate
          </Button>
        </div>

        {/* Certificate Details */}
        <Card className="mt-8">
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
                <span className="font-medium text-octamy-gray-700">Issued:</span>
                <span className="ml-2">{new Date(certificate.issuedAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Status:</span>
                <span className={`ml-2 ${isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {isActive ? 'Active' : !certificate.isPaid ? 'Unpaid' : isExpired ? 'Expired' : 'Invalid'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}